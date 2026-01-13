import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { JavaInfo, SystemPaths, SystemStatus } from "@/lib/types";

export function useSystemCheck() {
  const [status, setStatus] = useState<SystemStatus>({
    java: null,
    paths: null,
    loading: true,
    error: null,
  });

  const checkSystem = useCallback(async () => {
    setStatus((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [java, paths] = await Promise.all([
        invoke<JavaInfo>("check_java"),
        invoke<SystemPaths>("get_system_paths"),
      ]);

      setStatus({
        java,
        paths,
        loading: false,
        error: null,
      });
    } catch (err) {
      setStatus({
        java: null,
        paths: null,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

  useEffect(() => {
    checkSystem();
  }, [checkSystem]);

  return { ...status, refresh: checkSystem };
}
