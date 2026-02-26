import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateState {
  checking: boolean;
  available: boolean;
  version: string | null;
  body: string | null;
  downloading: boolean;
  progress: number; // 0-100
  error: string | null;
}

const initialState: UpdateState = {
  checking: false,
  available: false,
  version: null,
  body: null,
  downloading: false,
  progress: 0,
  error: null,
};

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>(initialState);
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));
    try {
      const result = await check();
      if (result) {
        setUpdate(result);
        setState((s) => ({
          ...s,
          checking: false,
          available: true,
          version: result.version,
          body: result.body ?? null,
        }));
      } else {
        setState((s) => ({ ...s, checking: false, available: false }));
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        checking: false,
        error: e instanceof Error ? e.message : "Update check failed",
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;
    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              setState((s) => ({
                ...s,
                progress: Math.round((downloadedBytes / totalBytes) * 100),
              }));
            }
            break;
          case "Finished":
            setState((s) => ({ ...s, progress: 100 }));
            break;
        }
      });
      await relaunch();
    } catch (e) {
      setState((s) => ({
        ...s,
        downloading: false,
        error: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, [update]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // Check on mount (background, non-blocking)
  useEffect(() => {
    const timer = setTimeout(() => checkForUpdates(), 2000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    dismissed,
    checkForUpdates,
    installUpdate,
    dismiss,
  };
}
