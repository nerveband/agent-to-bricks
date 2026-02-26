import { useEffect, useRef, useState } from "react";
import { spawn, type IPty, type IDisposable } from "tauri-pty";
import { invoke } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import { registerPtyWriter } from "../atoms/ptyBridge";

// Use streaming mode so multi-byte UTF-8 sequences split across PTY
// chunks are buffered rather than emitted as replacement characters.
const decoder = new TextDecoder("utf-8", { fatal: false });

interface PlatformShell {
  os: string;
  shell: string;
  interactive_args: string[];
}

/** Build platform-appropriate shell arguments for executing a command. */
function buildShellArgs(
  shellInfo: PlatformShell,
  command: string,
  args: string[]
): string[] {
  if (!command) {
    // Interactive login shell — no command to execute
    return [...shellInfo.interactive_args];
  }

  const fullCmd = [command, ...args].join(" ");

  if (shellInfo.os === "windows") {
    const lower = shellInfo.shell.toLowerCase();
    if (lower.includes("powershell") || lower.includes("pwsh")) {
      return ["-NoLogo", "-Command", fullCmd];
    }
    // cmd.exe
    return ["/C", fullCmd];
  }

  // POSIX shells (bash, zsh, fish, sh)
  return ["--login", "-c", fullCmd];
}

export function usePty(
  terminal: Terminal | null,
  command: string | null,
  args: string[] = [],
  isActive: boolean = false,
  cwd?: string
) {
  const ptyRef = useRef<IPty | null>(null);
  // Signal so the writer-registration effect re-runs after async spawn completes.
  const [ptyReady, setPtyReady] = useState(false);

  // Spawn the PTY once and wire up I/O.
  // Deps: terminal, command, args — NOT isActive (that's handled below).
  useEffect(() => {
    if (!terminal) return;
    // command can be "" for a plain shell, or null to skip entirely
    if (command === null) return;

    let cancelled = false;
    const disposables: IDisposable[] = [];

    (async () => {
      try {
        // Resolve the platform shell from the Rust backend
        const shellInfo = await invoke<PlatformShell>("get_platform_shell");
        if (cancelled) return;

        const shellArgs = buildShellArgs(shellInfo, command, args);

        const spawnOpts: Record<string, unknown> = {
          cols: terminal.cols,
          rows: terminal.rows,
        };
        if (cwd) {
          spawnOpts.cwd = cwd;
        }

        const pty = spawn(shellInfo.shell, shellArgs, spawnOpts as any);
        if (cancelled) {
          try { pty.kill(); } catch { /* already gone */ }
          return;
        }
        ptyRef.current = pty;
        setPtyReady(true);

        // PTY -> Terminal
        // CRITICAL: tauri IPC returns Vec<u8> as a plain JS Array, not Uint8Array.
        // TextDecoder.decode() requires a BufferSource, so we must convert explicitly.
        disposables.push(
          pty.onData((data: Uint8Array | number[]) => {
            try {
              const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
              terminal.write(decoder.decode(bytes, { stream: true }));
            } catch {
              // Fallback: try writing raw if decode fails
              terminal.write(String.fromCharCode(...(data as number[])));
            }
          })
        );

        // PTY exit
        disposables.push(
          pty.onExit(({ exitCode }) => {
            terminal.writeln(
              `\r\n\x1B[2m[Process exited with code ${exitCode}]\x1B[0m`
            );
          })
        );

        // Terminal -> PTY: user input
        const inputDisposable = terminal.onData((data: string) => {
          pty.write(data);
        });
        disposables.push({ dispose: () => inputDisposable.dispose() });

        // Terminal resize -> PTY resize
        const resizeDisposable = terminal.onResize(
          ({ cols, rows }: { cols: number; rows: number }) => {
            try {
              pty.resize(cols, rows);
            } catch {
              // ignore resize errors if pty is gone
            }
          }
        );
        disposables.push({ dispose: () => resizeDisposable.dispose() });
      } catch (err) {
        terminal.writeln(`\x1B[31mFailed to spawn terminal: ${err instanceof Error ? err.message : String(err)}\x1B[0m`);
        terminal.writeln(`\x1B[33mEnsure your system shell is installed and accessible.\x1B[0m`);
      }
    })();

    return () => {
      cancelled = true;
      disposables.forEach((d) => d.dispose());
      registerPtyWriter(null);
      try {
        ptyRef.current?.kill();
      } catch {
        // ignore kill errors
      }
      ptyRef.current = null;
      setPtyReady(false);
    };
  }, [terminal, command, JSON.stringify(args), cwd]);

  // Separate effect: register/unregister the PTY writer when this
  // session becomes active/inactive. This MUST NOT be in the spawn
  // effect above — otherwise isActive changes would kill the PTY.
  // Depends on ptyReady so it re-runs after the async spawn completes.
  useEffect(() => {
    if (isActive && ptyRef.current) {
      const pty = ptyRef.current;
      registerPtyWriter((data: string) => pty.write(data));
      return () => registerPtyWriter(null);
    }
  }, [isActive, ptyReady]);
}
