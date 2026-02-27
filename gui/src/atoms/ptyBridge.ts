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
 * Waits at least `minDelay` ms (default 2s) to give tools like OpenCode
 * time to initialize before receiving input, then retries every 500ms
 * up to maxWait (default 15s).
 */
export function writeToActivePtyWhenReady(data: string, maxWait = 15000, minDelay = 2000): void {
  const doWrite = () => {
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
      } else if (elapsed >= maxWait - minDelay) {
        clearInterval(timer);
      }
    }, interval);
  };

  // Always wait the minimum delay so the tool has time to boot
  setTimeout(doWrite, minDelay);
}
