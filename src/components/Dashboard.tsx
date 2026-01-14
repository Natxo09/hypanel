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
import { CreateServerDialog } from "@/components/CreateServerDialog";
import { ImportServerDialog } from "@/components/ImportServerDialog";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import type { Instance, InstancesListResult, ServerStatusInfo } from "@/lib/types";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Map<string, string>>(new Map());
  const [missingFolders, setMissingFolders] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Version checking
  const {
    showBanner,
    latestVersion,
    outdatedCount,
    outdatedInstances,
    dismissBanner,
    markInstanceUpdated,
    checkInstanceVersion,
  } = useVersionCheck();

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
        // Check which folders are missing
        if (result.instances.length > 0) {
          const paths = result.instances.map((i) => [i.id, i.path] as [string, string]);
          const missing = await invoke<string[]>("check_instance_paths", { paths });
          setMissingFolders(new Set(missing));
        }
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
    setCreateDialogOpen(true);
  }

  function handleImportInstance() {
    setImportDialogOpen(true);
  }

  function handleServerCreated(newInstance: Instance) {
    console.log("[Dashboard] handleServerCreated called with:", newInstance);
    setInstances((prev) => {
      console.log("[Dashboard] Previous instances:", prev.length, "Adding new instance");
      return [...prev, newInstance];
    });
    // Optionally navigate to the new server
    setSelectedInstance(newInstance);
    setCurrentView("server");
    // Check version for the new instance
    checkInstanceVersion(newInstance.id);
  }

  function handleDeleteInstance(instanceId: string) {
    setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    setMissingFolders((prev) => {
      const newSet = new Set(prev);
      newSet.delete(instanceId);
      return newSet;
    });
    // If we were viewing this server, go back to servers list
    if (selectedInstance?.id === instanceId) {
      setSelectedInstance(null);
      setCurrentView("servers");
    }
  }

  function handleInstanceUpdated(instanceId: string, newVersion: string) {
    // Update the instance's installed_version in state
    setInstances((prev) =>
      prev.map((i) =>
        i.id === instanceId ? { ...i, installed_version: newVersion } : i
      )
    );
    // Remove from outdated instances map
    markInstanceUpdated(instanceId);
    // Also update selectedInstance if it matches
    if (selectedInstance?.id === instanceId) {
      setSelectedInstance((prev) =>
        prev ? { ...prev, installed_version: newVersion } : prev
      );
    }
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

          {showBanner && latestVersion && (
            <div className="m-4 mb-0">
              <UpdateBanner
                latestVersion={latestVersion}
                outdatedCount={outdatedCount}
                onDismiss={dismissBanner}
                onViewDetails={() => setCurrentView("servers")}
              />
            </div>
          )}

          {currentView === "home" && (
            <HomeView
              instances={instances}
              serverStatuses={serverStatuses}
              missingFolders={missingFolders}
              outdatedInstances={outdatedInstances}
              onSelectInstance={handleSelectInstance}
              onAddInstance={handleAddInstance}
              onImportInstance={handleImportInstance}
              onViewAllServers={() => setCurrentView("servers")}
            />
          )}

          {currentView === "servers" && (
            <ServersView
              instances={instances}
              serverStatuses={serverStatuses}
              missingFolders={missingFolders}
              outdatedInstances={outdatedInstances}
              latestVersion={latestVersion}
              onSelectInstance={handleSelectInstance}
              onAddInstance={handleAddInstance}
              onImportInstance={handleImportInstance}
              onDeleteInstance={handleDeleteInstance}
              onInstanceUpdated={handleInstanceUpdated}
            />
          )}

          {currentView === "server" && selectedInstance && (
            <ServerDetailView
              instance={selectedInstance}
              allInstances={instances}
              onBack={handleBackToServers}
              onUpdateInstance={(updated) => {
                setSelectedInstance(updated);
                setInstances((prev) =>
                  prev.map((i) => (i.id === updated.id ? updated : i))
                );
              }}
            />
          )}

          {currentView === "backups" && <BackupsView />}

          {currentView === "settings" && <SettingsView />}
        </div>
      </div>

      <CreateServerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        instances={instances}
        onServerCreated={handleServerCreated}
      />

      <ImportServerDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        instances={instances}
        onServerImported={handleServerCreated}
      />
    </div>
  );
}
