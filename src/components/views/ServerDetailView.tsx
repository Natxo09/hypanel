import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Loader2,
  Play,
  Square,
  FolderOpen,
  Terminal,
  ExternalLink,
  FileText,
  Settings,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ConsoleTab,
  LogsTab,
  SettingsTab,
  MetricsTab,
  type ConsoleMessage,
} from "./server-detail";
import type {
  Instance,
  ServerStatus,
  ServerStatusInfo,
  ServerOutput,
  StartResult,
  StopResult,
  AuthEvent,
  ServerMetrics,
  LogFile,
  LogReadResult,
} from "@/lib/types";

interface ServerDetailViewProps {
  instance: Instance;
  onBack: () => void;
  onUpdateInstance?: (instance: Instance) => void;
}

export function ServerDetailView({ instance, onBack, onUpdateInstance }: ServerDetailViewProps) {
  // Server state
  const [status, setStatus] = useState<ServerStatus>("stopped");
  const [, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [authEvent, setAuthEvent] = useState<AuthEvent | null>(null);
  const [activeTab, setActiveTab] = useState("console");

  // Console state
  const [consoleOutput, setConsoleOutput] = useState<ConsoleMessage[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [messageIdRef] = useState({ current: 0 });

  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    name: instance.name,
    java_path: instance.java_path || "",
    jvm_args: instance.jvm_args || "",
    server_args: instance.server_args || "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Logs state
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<LogReadResult | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);

  // Add message to console
  const addConsoleMessage = useCallback((text: string, type: ConsoleMessage["type"]) => {
    setConsoleOutput((prev) => [
      ...prev,
      {
        id: messageIdRef.current++,
        text,
        type,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [messageIdRef]);

  // Fetch initial status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const statusInfo = await invoke<ServerStatusInfo>("get_server_status", {
          instanceId: instance.id,
        });
        setStatus(statusInfo.status);
        setPid(statusInfo.pid);
        setStartedAt(statusInfo.started_at);
      } catch (err) {
        console.error("Failed to get server status:", err);
      }
    }
    fetchStatus();
  }, [instance.id]);

  // Subscribe to events
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    listen<ServerOutput>("server-output", (event) => {
      if (event.payload.instance_id === instance.id) {
        addConsoleMessage(
          event.payload.line,
          event.payload.stream as "stdout" | "stderr"
        );
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<ServerStatusInfo>("server-status-change", (event) => {
      if (event.payload.instance_id === instance.id) {
        setStatus(event.payload.status);
        setPid(event.payload.pid);
        setStartedAt(event.payload.started_at);

        if (event.payload.status === "running") {
          addConsoleMessage("Server started successfully", "system");
        } else if (event.payload.status === "stopped") {
          addConsoleMessage("Server stopped", "system");
          setAuthEvent(null);
        }
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<AuthEvent>("server-auth-required", (event) => {
      if (event.payload.instance_id === instance.id) {
        setAuthEvent(event.payload);
        addConsoleMessage(
          `Authentication required. Code: ${event.payload.code}`,
          "system"
        );
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<string>("server-auth-success", (event) => {
      if (event.payload === instance.id) {
        setAuthEvent(null);
        addConsoleMessage("Authentication successful!", "system");
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    listen<string>("server-exit", (event) => {
      if (event.payload === instance.id) {
        addConsoleMessage("Server process exited", "system");
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [instance.id, addConsoleMessage]);

  // Fetch metrics periodically when running
  useEffect(() => {
    if (status !== "running") {
      setMetrics(null);
      return;
    }

    async function fetchMetrics() {
      try {
        const m = await invoke<ServerMetrics>("get_server_metrics", {
          instanceId: instance.id,
        });
        setMetrics(m);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [instance.id, status]);

  // Fetch log files when logs tab is active
  useEffect(() => {
    if (activeTab !== "logs") return;

    async function fetchLogFiles() {
      setIsLoadingLogs(true);
      try {
        const result = await invoke<{ success: boolean; files: LogFile[]; error?: string }>(
          "list_log_files",
          { instancePath: instance.path }
        );
        if (result.success) {
          setLogFiles(result.files);
          if (result.files.length > 0 && !selectedLog) {
            setSelectedLog(result.files[0].path);
          }
        }
      } catch (err) {
        console.error("Failed to fetch log files:", err);
      } finally {
        setIsLoadingLogs(false);
      }
    }

    fetchLogFiles();
  }, [activeTab, instance.path, selectedLog]);

  // Fetch log content when selected log changes
  useEffect(() => {
    if (!selectedLog) return;

    async function fetchLogContent() {
      try {
        const result = await invoke<LogReadResult>("read_log_file", {
          filePath: selectedLog,
          tailLines: 500,
        });
        setLogContent(result);
      } catch (err) {
        console.error("Failed to read log file:", err);
      }
    }

    fetchLogContent();
  }, [selectedLog]);

  // Start server
  async function handleStart() {
    setConsoleOutput([]);
    addConsoleMessage("Starting server...", "system");

    try {
      const result = await invoke<StartResult>("start_server", {
        instanceId: instance.id,
        instancePath: instance.path,
        javaPath: instance.java_path,
        jvmArgs: instance.jvm_args,
        serverArgs: instance.server_args,
      });

      if (!result.success) {
        addConsoleMessage(`Error: ${result.error}`, "stderr");
        setStatus("stopped");
      }
    } catch (err) {
      addConsoleMessage(`Failed to start: ${err}`, "stderr");
      setStatus("stopped");
    }
  }

  // Stop server
  async function handleStop() {
    addConsoleMessage("Stopping server...", "system");

    try {
      const result = await invoke<StopResult>("stop_server", {
        instanceId: instance.id,
      });

      if (!result.success) {
        addConsoleMessage(`Error: ${result.error}`, "stderr");
      }
    } catch (err) {
      addConsoleMessage(`Failed to stop: ${err}`, "stderr");
    }
  }

  // Send command
  async function handleSendCommand(e?: React.FormEvent) {
    e?.preventDefault();

    if (!commandInput.trim() || status !== "running") return;

    const cmd = commandInput.trim();
    addConsoleMessage(`> ${cmd}`, "command");

    setCommandHistory((prev) => [...prev.filter((c) => c !== cmd), cmd]);
    setHistoryIndex(-1);
    setCommandInput("");

    try {
      await invoke("send_server_command", {
        instanceId: instance.id,
        command: cmd,
      });
    } catch (err) {
      addConsoleMessage(`Failed to send command: ${err}`, "stderr");
    }
  }

  // Handle key navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  }

  // Open folder
  async function handleOpenFolder() {
    try {
      const opener = await import("@tauri-apps/plugin-opener");
      await opener.openPath(instance.path);
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }

  // Save settings
  async function handleSaveSettings() {
    setIsSavingSettings(true);
    try {
      await invoke("update_server_instance", {
        id: instance.id,
        name: settingsForm.name,
        javaPath: settingsForm.java_path || null,
        jvmArgs: settingsForm.jvm_args || null,
        serverArgs: settingsForm.server_args || null,
      });

      if (onUpdateInstance) {
        onUpdateInstance({
          ...instance,
          name: settingsForm.name,
          java_path: settingsForm.java_path || null,
          jvm_args: settingsForm.jvm_args || null,
          server_args: settingsForm.server_args || null,
        });
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSavingSettings(false);
    }
  }

  // Refresh log content
  function handleRefreshLog() {
    if (selectedLog) {
      setSelectedLog(selectedLog);
    }
  }

  // Format uptime
  function formatUptime(): string {
    if (!startedAt) return "-";
    const start = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  const isRunning = status === "running";
  const isLoading = status === "starting" || status === "stopping";

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={instance.name} backButton onBack={onBack}>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-xs text-muted-foreground">{formatUptime()}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isRunning ? "bg-green-500" : isLoading ? "bg-yellow-500 animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-sm capitalize">{status}</span>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-hidden p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="console" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" />
                Console
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Metrics
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenFolder}>
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                Open Folder
              </Button>
              {status === "stopped" ? (
                <Button size="sm" onClick={handleStart}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Start
                </Button>
              ) : isLoading ? (
                <Button size="sm" disabled>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {status === "starting" ? "Starting..." : "Stopping..."}
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={handleStop}>
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {/* Auth Banner */}
          {authEvent && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-yellow-500">Authentication required</span>
                <code className="rounded bg-background/50 px-2 py-0.5 text-sm font-mono">
                  {authEvent.code}
                </code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(authEvent.auth_url, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open Auth Page
              </Button>
            </div>
          )}

          {/* Console Tab */}
          <TabsContent value="console" className="flex-1 flex flex-col min-h-0 mt-0">
            <ConsoleTab
              consoleOutput={consoleOutput}
              commandInput={commandInput}
              isRunning={isRunning}
              status={status}
              onCommandChange={setCommandInput}
              onSendCommand={handleSendCommand}
              onKeyDown={handleKeyDown}
            />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 mt-0">
            <LogsTab
              logFiles={logFiles}
              selectedLog={selectedLog}
              logContent={logContent}
              isLoading={isLoadingLogs}
              onSelectLog={setSelectedLog}
              onRefresh={handleRefreshLog}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-auto mt-0">
            <SettingsTab
              instance={instance}
              settingsForm={settingsForm}
              isSaving={isSavingSettings}
              onFormChange={(updates) => setSettingsForm((s) => ({ ...s, ...updates }))}
              onSave={handleSaveSettings}
            />
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="flex-1 overflow-auto mt-0">
            <MetricsTab
              isRunning={isRunning}
              metrics={metrics}
              uptime={formatUptime()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
