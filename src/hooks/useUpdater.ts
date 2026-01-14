import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useState, useEffect, useCallback } from "react";

interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  update: Update | null;
  error: string | null;
  lastChecked: number | null;
}

const initialState: UpdateState = {
  checking: false,
  available: false,
  downloading: false,
  progress: 0,
  update: null,
  error: null,
  lastChecked: null,
};

// Check for updates every 6 hours
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export function useUpdater(checkOnMount = true) {
  const [state, setState] = useState<UpdateState>(initialState);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));

    try {
      const update = await check();
      setState((s) => ({
        ...s,
        checking: false,
        available: !!update,
        update,
        lastChecked: Date.now(),
      }));
      if (update) {
        setDismissed(false);
      }
      return update;
    } catch (error) {
      console.error("Update check failed:", error);
      setState((s) => ({
        ...s,
        checking: false,
        error:
          error instanceof Error ? error.message : "Error checking for updates",
        lastChecked: Date.now(),
      }));
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.update) return;

    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));

    try {
      let downloaded = 0;
      let contentLength = 0;

      await state.update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            const progress =
              contentLength > 0
                ? Math.round((downloaded / contentLength) * 100)
                : 0;
            setState((s) => ({ ...s, progress }));
            break;
          case "Finished":
            setState((s) => ({ ...s, progress: 100 }));
            break;
        }
      });

      // Relaunch the application
      await relaunch();
    } catch (error) {
      console.error("Update download failed:", error);
      setState((s) => ({
        ...s,
        downloading: false,
        error:
          error instanceof Error
            ? error.message
            : "Error downloading update",
      }));
    }
  }, [state.update]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setDismissed(false);
  }, []);

  // Check on mount if enabled
  useEffect(() => {
    if (checkOnMount) {
      // Small delay to not block initial render
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkForUpdates]);

  // Periodic update check every 6 hours
  useEffect(() => {
    if (!checkOnMount) return;

    const interval = setInterval(() => {
      checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [checkOnMount, checkForUpdates]);

  // Computed: up to date when checked, no update available, and no error
  const upToDate = state.lastChecked !== null && !state.available && !state.error;

  return {
    ...state,
    upToDate,
    dismissed,
    checkForUpdates,
    downloadAndInstall,
    dismiss,
    reset,
  };
}
