import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Loader2 } from "lucide-react";
import { WindowTitlebar } from "@/components/layout/WindowTitlebar";
import { IconSidebar, type View } from "@/components/layout/IconSidebar";
import { HomeView } from "@/components/views/HomeView";
import { ServersView } from "@/components/views/ServersView";
import { ServerDetailView } from "@/components/views/ServerDetailView";
import { BackupsView } from "@/components/views/BackupsView";
import { SettingsView } from "@/components/views/SettingsView";
import type { Instance, InstancesListResult, ServerStatusInfo } from "@/lib/types";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Map<string, string>>(new Map());

  // Load instances
  useEffect(() => {
    loadInstances();
  }, []);

  // Subscribe to server status changes
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    listen<ServerStatusInfo>("server-status-change", (event) => {
      setServerStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(event.payload.instance_id, event.payload.status);
        return newMap;
      });
    }).then((unlisten) => unlisteners.push(unlisten));

    // Also fetch initial statuses
    fetchServerStatuses();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  async function loadInstances() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<InstancesListResult>("get_server_instances");
      if (result.success) {
        setInstances(result.instances);
      } else {
        setError(result.error || "Failed to load instances");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchServerStatuses() {
    try {
      const statuses = await invoke<ServerStatusInfo[]>("get_all_server_statuses");
      const statusMap = new Map<string, string>();
      statuses.forEach((s) => {
        statusMap.set(s.instance_id, s.status);
      });
      setServerStatuses(statusMap);
    } catch (err) {
      console.error("Failed to fetch server statuses:", err);
    }
  }

  function handleSelectInstance(instance: Instance) {
    setSelectedInstance(instance);
    setCurrentView("server");
  }

  function handleBackToServers() {
    setCurrentView("servers");
    setSelectedInstance(null);
  }

  function handleAddInstance() {
    // TODO: Open add instance dialog
    console.log("Add instance");
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <WindowTitlebar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <WindowTitlebar />
      <div className="flex flex-1 min-h-0">
        <IconSidebar currentView={currentView} onViewChange={setCurrentView} />

        <div className="flex flex-1 flex-col min-w-0">
          {error && (
            <div className="m-4 mb-0 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {currentView === "home" && (
            <HomeView
              instances={instances}
              serverStatuses={serverStatuses}
              onSelectInstance={handleSelectInstance}
              onAddInstance={handleAddInstance}
              onViewAllServers={() => setCurrentView("servers")}
            />
          )}

          {currentView === "servers" && (
            <ServersView
              instances={instances}
              serverStatuses={serverStatuses}
              onSelectInstance={handleSelectInstance}
              onAddInstance={handleAddInstance}
            />
          )}

          {currentView === "server" && selectedInstance && (
            <ServerDetailView
              instance={selectedInstance}
              allInstances={instances}
              onBack={handleBackToServers}
            />
          )}

          {currentView === "backups" && <BackupsView />}

          {currentView === "settings" && <SettingsView />}
        </div>
      </div>
    </div>
  );
}
