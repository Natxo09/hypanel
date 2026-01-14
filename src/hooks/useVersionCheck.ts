import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { VersionSettings, VersionCheckResult, VersionUpdateEvent } from "@/lib/types";

interface VersionCheckState {
  loading: boolean;
  settings: VersionSettings;
  outdatedInstances: Map<string, VersionCheckResult>;
  latestVersion: string | null;
  bannerDismissed: boolean;
  error: string | null;
}

export function useVersionCheck() {
  const [state, setState] = useState<VersionCheckState>({
    loading: true,
    settings: {
      check_on_startup: true,
      check_periodic: false,
      check_on_server_start: true,
    },
    outdatedInstances: new Map(),
    latestVersion: null,
    bannerDismissed: false,
    error: null,
  });

  // Load settings from backend
  const loadSettings = useCallback(async () => {
    try {
      const settings = await invoke<VersionSettings>("get_version_settings");
      setState((prev) => ({ ...prev, settings }));
    } catch (err) {
      console.error("[useVersionCheck] Failed to load settings:", err);
    }
  }, []);

  // Save settings to backend
  const saveSettings = useCallback(async (newSettings: VersionSettings) => {
    try {
      const success = await invoke<boolean>("set_version_settings", { settings: newSettings });
      if (success) {
        setState((prev) => ({ ...prev, settings: newSettings }));
      }
      return success;
    } catch (err) {
      console.error("[useVersionCheck] Failed to save settings:", err);
      return false;
    }
  }, []);

  // Check all instances for updates
  const checkAllVersions = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const results = await invoke<VersionCheckResult[]>("check_all_versions");
      const outdatedMap = new Map<string, VersionCheckResult>();
      let latestVersion: string | null = null;

      for (const result of results) {
        if (result.available_version) {
          latestVersion = result.available_version;
        }
        // Include both outdated and unknown version instances
        if (result.update_available || result.version_unknown) {
          outdatedMap.set(result.instance_id, result);
        }
      }

      // Check if banner was dismissed for this version
      const dismissedVersion = await invoke<string | null>("get_dismissed_version");
      const bannerDismissed = dismissedVersion === latestVersion;

      setState((prev) => ({
        ...prev,
        loading: false,
        outdatedInstances: outdatedMap,
        latestVersion,
        bannerDismissed,
        error: null,
      }));

      return results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check versions";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
      return [];
    }
  }, []);

  // Check a specific instance for updates
  const checkInstanceVersion = useCallback(async (instanceId: string) => {
    try {
      const result = await invoke<VersionCheckResult | null>("check_instance_version", {
        instanceId,
      });

      if (result) {
        setState((prev) => {
          const newOutdated = new Map(prev.outdatedInstances);
          // Include both outdated and unknown version instances
          if (result.update_available || result.version_unknown) {
            newOutdated.set(result.instance_id, result);
          } else {
            newOutdated.delete(result.instance_id);
          }
          return {
            ...prev,
            outdatedInstances: newOutdated,
            latestVersion: result.available_version || prev.latestVersion,
          };
        });
      }

      return result;
    } catch (err) {
      console.error("[useVersionCheck] Failed to check instance version:", err);
      return null;
    }
  }, []);

  // Dismiss the update banner
  const dismissBanner = useCallback(async () => {
    if (!state.latestVersion) return false;

    try {
      const success = await invoke<boolean>("dismiss_version_banner", {
        version: state.latestVersion,
      });
      if (success) {
        setState((prev) => ({ ...prev, bannerDismissed: true }));
      }
      return success;
    } catch (err) {
      console.error("[useVersionCheck] Failed to dismiss banner:", err);
      return false;
    }
  }, [state.latestVersion]);

  // Check if a specific instance is outdated
  const isInstanceOutdated = useCallback(
    (instanceId: string) => {
      return state.outdatedInstances.has(instanceId);
    },
    [state.outdatedInstances]
  );

  // Get version info for a specific instance
  const getInstanceVersionInfo = useCallback(
    (instanceId: string) => {
      return state.outdatedInstances.get(instanceId) || null;
    },
    [state.outdatedInstances]
  );

  // Mark an instance as updated (remove from outdated map)
  const markInstanceUpdated = useCallback((instanceId: string) => {
    setState((prev) => {
      const newOutdated = new Map(prev.outdatedInstances);
      newOutdated.delete(instanceId);
      return {
        ...prev,
        outdatedInstances: newOutdated,
      };
    });
  }, []);

  // Initialize: load settings and check versions on startup if enabled
  useEffect(() => {
    const init = async () => {
      await loadSettings();
      const settings = await invoke<VersionSettings>("get_version_settings");
      if (settings.check_on_startup) {
        await checkAllVersions();
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    init();
  }, [loadSettings, checkAllVersions]);

  // Listen for background version update events
  useEffect(() => {
    const unlisten = listen<VersionUpdateEvent>("version-update-available", (event) => {
      console.log("[useVersionCheck] Received version update event:", event.payload);

      const { results, available_version } = event.payload;
      const outdatedMap = new Map<string, VersionCheckResult>();

      for (const result of results) {
        // Include both outdated and unknown version instances
        if (result.update_available || result.version_unknown) {
          outdatedMap.set(result.instance_id, result);
        }
      }

      setState((prev) => ({
        ...prev,
        outdatedInstances: outdatedMap,
        latestVersion: available_version,
        bannerDismissed: false, // New version means banner should show
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return {
    loading: state.loading,
    settings: state.settings,
    outdatedInstances: state.outdatedInstances,
    outdatedCount: state.outdatedInstances.size,
    latestVersion: state.latestVersion,
    bannerDismissed: state.bannerDismissed,
    showBanner: state.outdatedInstances.size > 0 && !state.bannerDismissed,
    error: state.error,
    // Actions
    loadSettings,
    saveSettings,
    checkAllVersions,
    checkInstanceVersion,
    dismissBanner,
    isInstanceOutdated,
    getInstanceVersionInfo,
    markInstanceUpdated,
  };
}
