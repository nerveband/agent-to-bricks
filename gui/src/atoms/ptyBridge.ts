/**
 * A simple bridge to write commands to the active PTY from outside the terminal.
 * The active SessionTerminal registers its PTY write function here.
 */

type PtyWriter = (data: string) => void;

let activeWriter: PtyWriter | null = null;

export function registerPtyWriter(writer: PtyWriter | null) {
  activeWriter = writer;
}

export function writeToActivePty(data: string) {
  if (activeWriter) {
    activeWriter(data);
  }
}

/**
 * Write to PTY once a writer becomes available.
 * Retries every 500ms up to maxWait (default 10s).
 */
export function writeToActivePtyWhenReady(data: string, maxWait = 10000): void {
  if (activeWriter) {
    activeWriter(data);
    return;
  }
  const interval = 500;
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += interval;
    if (activeWriter) {
      clearInterval(timer);
      activeWriter(data);
    } else if (elapsed >= maxWait) {
      clearInterval(timer);
    }
  }, interval);
}
