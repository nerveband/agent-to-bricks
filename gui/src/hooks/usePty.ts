import { useEffect, useRef } from "react";
import { spawn, type IPty, type IDisposable } from "tauri-pty";
import type { Terminal } from "@xterm/xterm";
import { registerPtyWriter } from "../atoms/ptyBridge";

// Use streaming mode so multi-byte UTF-8 sequences split across PTY
// chunks are buffered rather than emitted as replacement characters.
const decoder = new TextDecoder("utf-8", { fatal: false });

export function usePty(
  terminal: Terminal | null,
  command: string | null,
  args: string[] = [],
  isActive: boolean = false,
  cwd?: string
) {
  const ptyRef = useRef<IPty | null>(null);

  // Spawn the PTY once and wire up I/O.
  // Deps: terminal, command, args — NOT isActive (that's handled below).
  useEffect(() => {
    if (!terminal) return;
    // command can be "" for a plain shell, or null to skip entirely
    if (command === null) return;

    const disposables: IDisposable[] = [];

    try {
      // Empty command = interactive login shell; otherwise run the tool
      const shellArgs: string[] = command
        ? ["--login", "-c", [command, ...args].join(" ")]
        : ["--login"];

      const spawnOpts: Record<string, unknown> = {
        cols: terminal.cols,
        rows: terminal.rows,
      };
      if (cwd) {
        spawnOpts.cwd = cwd;
      }

      const pty = spawn("/bin/zsh", shellArgs, spawnOpts as any);
      ptyRef.current = pty;

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
      terminal.writeln(`\x1B[31mFailed to spawn: ${err instanceof Error ? err.message : String(err)}\x1B[0m`);
    }

    return () => {
      disposables.forEach((d) => d.dispose());
      registerPtyWriter(null);
      try {
        ptyRef.current?.kill();
      } catch {
        // ignore kill errors
      }
      ptyRef.current = null;
    };
  }, [terminal, command, JSON.stringify(args), cwd]);

  // Separate effect: register/unregister the PTY writer when this
  // session becomes active/inactive. This MUST NOT be in the spawn
  // effect above — otherwise isActive changes would kill the PTY.
  useEffect(() => {
    if (isActive && ptyRef.current) {
      const pty = ptyRef.current;
      registerPtyWriter((data: string) => pty.write(data));
      return () => registerPtyWriter(null);
    }
  }, [isActive]);
}
