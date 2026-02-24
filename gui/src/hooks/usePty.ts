import { useEffect, useRef } from "react";
import { spawn, type IPty, type IDisposable } from "tauri-pty";
import type { Terminal } from "@xterm/xterm";

const decoder = new TextDecoder();

export function usePty(
  terminal: Terminal | null,
  command: string | null,
  args: string[] = []
) {
  const ptyRef = useRef<IPty | null>(null);

  useEffect(() => {
    if (!terminal || !command) return;

    const disposables: IDisposable[] = [];

    const pty = spawn(command, args, {
      cols: terminal.cols,
      rows: terminal.rows,
    });
    ptyRef.current = pty;

    // PTY -> Terminal: onData returns Uint8Array, decode to string
    disposables.push(
      pty.onData((data: Uint8Array) => {
        terminal.write(decoder.decode(data));
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

    return () => {
      disposables.forEach((d) => d.dispose());
      inputDisposable.dispose();
      resizeDisposable.dispose();
      try {
        pty.kill();
      } catch {
        // ignore kill errors
      }
      ptyRef.current = null;
    };
  }, [terminal, command, JSON.stringify(args)]);
}
