import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, Plus, Play, Square, Loader2, MoreHorizontal, Trash2, FolderOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { DeleteServerDialog } from "@/components/DeleteServerDialog";
import type { Instance, StartResult, StopResult, ServerMetrics } from "@/lib/types";

interface ServersViewProps {
  instances: Instance[];
  serverStatuses: Map<string, string>;
  missingFolders: Set<string>;
  onSelectInstance: (instance: Instance) => void;
  onAddInstance: () => void;
  onDeleteInstance: (instanceId: string) => void;
}

export function ServersView({
  instances,
  serverStatuses,
  missingFolders,
  onSelectInstance,
  onAddInstance,
  onDeleteInstance,
}: ServersViewProps) {
  const [serverMetrics, setServerMetrics] = useState<Map<string, ServerMetrics>>(new Map());
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<Instance | null>(null);

  // Fetch metrics for running servers
  useEffect(() => {
    async function fetchMetrics() {
      try {
        const metrics = await invoke<ServerMetrics[]>("get_all_server_metrics");
        const metricsMap = new Map<string, ServerMetrics>();
        metrics.forEach((m) => metricsMap.set(m.instance_id, m));
        setServerMetrics(metricsMap);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  function getStatus(instanceId: string): string {
    return serverStatuses.get(instanceId) || "stopped";
  }

  async function handleStart(e: React.MouseEvent, instance: Instance) {
    e.stopPropagation();
    setLoadingAction(instance.id);

    try {
      await invoke<StartResult>("start_server", {
        instanceId: instance.id,
        instancePath: instance.path,
        javaPath: instance.java_path,
        jvmArgs: instance.jvm_args,
        serverArgs: instance.server_args,
      });
    } catch (err) {
      console.error("Failed to start server:", err);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleStop(e: React.MouseEvent, instance: Instance) {
    e.stopPropagation();
    setLoadingAction(instance.id);

    try {
      await invoke<StopResult>("stop_server", {
        instanceId: instance.id,
      });
    } catch (err) {
      console.error("Failed to stop server:", err);
    } finally {
      setLoadingAction(null);
    }
  }

  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  function formatMemory(mb: number): string {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Servers">
        <Button onClick={onAddInstance}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4">
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 py-12">
            <Server className="h-10 w-10 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1">No servers yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Create your first server to get started
            </p>
            <Button size="sm" onClick={onAddInstance}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Server
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-3 text-xs">Server</TableHead>
                  <TableHead className="h-9 px-3 text-xs">Status</TableHead>
                  <TableHead className="h-9 px-3 text-xs hidden md:table-cell">Path</TableHead>
                  <TableHead className="h-9 px-3 text-xs hidden lg:table-cell">Memory</TableHead>
                  <TableHead className="h-9 px-3 text-xs hidden lg:table-cell">Uptime</TableHead>
                  <TableHead className="h-9 px-3 text-xs text-right w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => {
                  const status = getStatus(instance.id);
                  const isRunning = status === "running";
                  const isLoading =
                    loadingAction === instance.id ||
                    status === "starting" ||
                    status === "stopping";
                  const metrics = serverMetrics.get(instance.id);
                  const isMissing = missingFolders.has(instance.id);

                  return (
                    <TableRow
                      key={instance.id}
                      className={isMissing ? "opacity-75" : "cursor-pointer"}
                      onClick={() => !isMissing && onSelectInstance(instance)}
                    >
                      <TableCell className="py-2 px-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-md ${
                              isMissing
                                ? "bg-yellow-500/10"
                                : isRunning
                                  ? "bg-green-500/10"
                                  : "bg-muted"
                            }`}
                          >
                            <Server
                              className={`h-3.5 w-3.5 ${
                                isMissing
                                  ? "text-yellow-500"
                                  : isRunning
                                    ? "text-green-500"
                                    : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{instance.name}</span>
                            {isMissing && (
                              <span className="text-[10px] text-yellow-500">Folder missing</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isRunning ? "bg-green-500" : "bg-muted-foreground/40"
                            }`}
                          />
                          <span className={`text-xs ${isRunning ? "text-green-500" : "text-muted-foreground"}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 px-3 hidden md:table-cell">
                        <span className="text-muted-foreground font-mono text-[11px] truncate block max-w-[200px]">
                          {instance.path}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {metrics?.memory_mb
                            ? formatMemory(metrics.memory_mb)
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {metrics?.uptime_seconds
                            ? formatUptime(metrics.uptime_seconds)
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isMissing && (
                            isLoading ? (
                              <Button size="icon" variant="ghost" className="h-7 w-7" disabled>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              </Button>
                            ) : isRunning ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => handleStop(e, instance)}
                              >
                                <Square className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-green-500"
                                onClick={(e) => handleStart(e, instance)}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isMissing && (
                                <>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectInstance(instance);
                                  }}>
                                    <Settings className="h-4 w-4" />
                                    Settings
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    invoke("open_folder", { path: instance.path });
                                  }}>
                                    <FolderOpen className="h-4 w-4" />
                                    Open folder
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInstanceToDelete(instance);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {isMissing ? "Remove from list" : "Delete"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <DeleteServerDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        instance={instanceToDelete}
        onDeleted={onDeleteInstance}
        folderMissing={instanceToDelete ? missingFolders.has(instanceToDelete.id) : false}
      />
    </div>
  );
}
