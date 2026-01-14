import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Users,
  FileJson,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ConsoleTab,
  LogsTab,
  SettingsTab,
  MetricsTab,
  PlayersTab,
  FilesTab,
  WorldsTab,
  type MetricDataPoint,
} from "./server-detail";
import { useConsoleStore, type ConsoleMessage } from "@/lib/console-store";
import type {
  Instance,
  ServerStatus,
  ServerStatusInfo,
  ServerOutput,
  StartResult,
  StopResult,
  AuthEvent,
  AuthNeededEvent,
  AuthSuccessEvent,
  AuthStatus,
  ServerMetrics,
  SystemMetrics,
  LogFile,
  LogReadResult,
  OnlinePlayer,
  PlayerJoinEvent,
  PlayerLeaveEvent,
  OnlinePlayersResponse,
} from "@/lib/types";

interface ServerDetailViewProps {
  instance: Instance;
  allInstances: Instance[];
  onBack: () => void;
  onUpdateInstance?: (instance: Instance) => void;
}

export function ServerDetailView({ instance: initialInstance, allInstances, onBack, onUpdateInstance }: ServerDetailViewProps) {
  // Console store (persists across navigation)
  const consoleStore = useConsoleStore();

  // Local instance state (to update when auth changes)
  const [instance, setInstance] = useState<Instance>(initialInstance);

  // Server state
  const [status, setStatus] = useState<ServerStatus>("stopped");
  const [, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("none");
  const [authEvent, setAuthEvent] = useState<AuthEvent | null>(null);
  const [startingAuth, setStartingAuth] = useState(false);
  const [needsPersistence, setNeedsPersistence] = useState(false);
  const [savingPersistence, setSavingPersistence] = useState(false);
  const [activeTab, setActiveTab] = useState("console");

  // Console state (local UI state)
  const [commandInput, setCommandInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [consoleRefreshKey, setConsoleRefreshKey] = useState(0);

  // Get messages from store (memoized to trigger re-renders)
  const consoleOutput = useMemo(() => {
    // consoleRefreshKey triggers re-computation when messages are added
    void consoleRefreshKey;
    return consoleStore.getMessages(instance.id);
  }, [consoleStore, instance.id, consoleRefreshKey]);

  const commandHistory = useMemo(() => {
    return consoleStore.getCommandHistory(instance.id);
  }, [consoleStore, instance.id, consoleRefreshKey]);

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
  const [metricsHistory, setMetricsHistory] = useState<MetricDataPoint[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  // Players state
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);

  // Add message to console (using store)
  const addConsoleMessage = useCallback((text: string, type: ConsoleMessage["type"]) => {
    consoleStore.addMessage(instance.id, text, type);
    setConsoleRefreshKey((k) => k + 1);
  }, [consoleStore, instance.id]);

  // Clear console
  const clearConsole = useCallback(() => {
    consoleStore.clearMessages(instance.id);
    setConsoleRefreshKey((k) => k + 1);
  }, [consoleStore, instance.id]);

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

  // Reload instance from database
  const reloadInstance = useCallback(async () => {
    try {
      const result = await invoke<{ success: boolean; instance: Instance | null }>(
        "get_server_instance",
        { instanceId: instance.id }
      );
      if (result.success && result.instance) {
        setInstance(result.instance);
        onUpdateInstance?.(result.instance);
      }
    } catch (err) {
      console.error("Failed to reload instance:", err);
    }
  }, [instance.id, onUpdateInstance]);

  // Fetch system metrics (for settings tab memory configuration)
  useEffect(() => {
    async function fetchSystemMetrics() {
      try {
        const sysMetrics = await invoke<SystemMetrics>("get_system_metrics");
        setSystemMetrics(sysMetrics);
      } catch (err) {
        console.error("Failed to get system metrics:", err);
      }
    }
    fetchSystemMetrics();
  }, []);

  // Subscribe to events - use ref to avoid stale closures
  const addMessageRef = useRef(addConsoleMessage);
  addMessageRef.current = addConsoleMessage;

  useEffect(() => {
    let isMounted = true;
    const unlisteners: UnlistenFn[] = [];

    async function setupListeners() {
      const outputUnlisten = await listen<ServerOutput>("server-output", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          addMessageRef.current(
            event.payload.line,
            event.payload.stream as "stdout" | "stderr"
          );
        }
      });
      if (isMounted) unlisteners.push(outputUnlisten);

      const statusUnlisten = await listen<ServerStatusInfo>("server-status-change", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setStatus(event.payload.status);
          setPid(event.payload.pid);
          setStartedAt(event.payload.started_at);

          if (event.payload.status === "running") {
            addMessageRef.current("Server started successfully", "system");
          } else if (event.payload.status === "stopped") {
            addMessageRef.current("Server stopped", "system");
            setAuthStatus("none");
            setAuthEvent(null);
            setStartingAuth(false);
            setOnlinePlayers([]);
          }
        }
      });
      if (isMounted) unlisteners.push(statusUnlisten);

      // Listen for "server needs auth" event (before /auth login is executed)
      const authNeededUnlisten = await listen<AuthNeededEvent>("server-auth-needed", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setAuthStatus("needs_auth");
          addMessageRef.current(
            "Server requires authentication. Click 'Start Authentication' to begin.",
            "system"
          );
        }
      });
      if (isMounted) unlisteners.push(authNeededUnlisten);

      // Listen for auth code ready (after /auth login is executed)
      const authUnlisten = await listen<AuthEvent>("server-auth-required", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setAuthStatus("awaiting_code");
          setAuthEvent(event.payload);
          setStartingAuth(false);
          addMessageRef.current(
            `Authentication code: ${event.payload.code}. Open the auth page to complete.`,
            "system"
          );
        }
      });
      if (isMounted) unlisteners.push(authUnlisten);

      const authSuccessUnlisten = await listen<AuthSuccessEvent>("server-auth-success", async (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setAuthStatus("authenticated");
          setAuthEvent(null);

          const profileMsg = event.payload.profile_name
            ? ` (${event.payload.profile_name})`
            : "";
          addMessageRef.current(
            `Authentication successful${profileMsg}! Server is now fully operational.`,
            "system"
          );

          // Save auth status to database and update local state
          try {
            await invoke("update_instance_auth_status", {
              instanceId: instance.id,
              authStatus: "authenticated",
              authPersistence: null,
              authProfileName: event.payload.profile_name,
            });

            // Update local instance state
            setInstance((prev) => ({
              ...prev,
              auth_status: "authenticated",
              auth_profile_name: event.payload.profile_name,
            }));
          } catch (err) {
            console.error("Failed to update auth status:", err);
          }
        }
      });
      if (isMounted) unlisteners.push(authSuccessUnlisten);

      // Listen for persistence warning
      const persistenceUnlisten = await listen<string>("server-auth-needs-persistence", (event) => {
        if (isMounted && event.payload === instance.id) {
          setNeedsPersistence(true);
        }
      });
      if (isMounted) unlisteners.push(persistenceUnlisten);

      const exitUnlisten = await listen<string>("server-exit", (event) => {
        if (isMounted && event.payload === instance.id) {
          addMessageRef.current("Server process exited", "system");
        }
      });
      if (isMounted) unlisteners.push(exitUnlisten);

      // Listen for player join events
      const playerJoinUnlisten = await listen<PlayerJoinEvent>("player-joined", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setOnlinePlayers((prev) => {
            // Avoid duplicates
            if (prev.some((p) => p.uuid === event.payload.player.uuid)) {
              return prev;
            }
            return [...prev, event.payload.player];
          });
          addMessageRef.current(`Player joined: ${event.payload.player.name}`, "system");
        }
      });
      if (isMounted) unlisteners.push(playerJoinUnlisten);

      // Listen for player leave events
      const playerLeaveUnlisten = await listen<PlayerLeaveEvent>("player-left", (event) => {
        if (isMounted && event.payload.instance_id === instance.id) {
          setOnlinePlayers((prev) => prev.filter((p) => p.uuid !== event.payload.uuid));
          addMessageRef.current(`Player left: ${event.payload.player_name}`, "system");
        }
      });
      if (isMounted) unlisteners.push(playerLeaveUnlisten);
    }

    setupListeners();

    return () => {
      isMounted = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [instance.id]);

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

        // Add to history (keep last 20 points)
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        setMetricsHistory((prev) => {
          const newHistory = [
            ...prev,
            {
              time: timeStr,
              cpu: m.cpu_usage !== null ? Math.round(m.cpu_usage * 10) / 10 : 0,
              memory: m.memory_mb !== null ? Math.round(m.memory_mb) : 0,
            },
          ];
          return newHistory.slice(-20);
        });
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [instance.id, status]);

  // Fetch online players when server starts running
  useEffect(() => {
    if (status !== "running") {
      setOnlinePlayers([]);
      return;
    }

    async function fetchPlayers() {
      try {
        const response = await invoke<OnlinePlayersResponse>("get_online_players", {
          instanceId: instance.id,
        });
        setOnlinePlayers(response.players);
      } catch (err) {
        console.error("Failed to fetch players:", err);
      }
    }

    fetchPlayers();
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
    // Clear console on start for a fresh view
    clearConsole();
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

  // Start authentication flow
  async function handleStartAuth() {
    setStartingAuth(true);
    addConsoleMessage("Starting authentication...", "system");

    try {
      await invoke("send_server_command", {
        instanceId: instance.id,
        command: "/auth login device",
      });
    } catch (err) {
      addConsoleMessage(`Failed to start auth: ${err}`, "stderr");
      setStartingAuth(false);
    }
  }

  // Save persistence settings
  async function handleSavePersistence() {
    setSavingPersistence(true);
    addConsoleMessage("Saving credentials with encryption...", "system");

    try {
      await invoke("send_server_command", {
        instanceId: instance.id,
        command: "/auth persistence Encrypted",
      });

      // Update database
      await invoke("update_instance_auth_status", {
        instanceId: instance.id,
        authStatus: null,
        authPersistence: "encrypted",
        authProfileName: null,
      });

      // Update local instance state
      setInstance((prev) => ({
        ...prev,
        auth_persistence: "encrypted",
      }));

      setNeedsPersistence(false);
      addConsoleMessage("Credentials saved! They will persist across restarts.", "system");
    } catch (err) {
      addConsoleMessage(`Failed to save persistence: ${err}`, "stderr");
    } finally {
      setSavingPersistence(false);
    }
  }

  // Send command
  async function handleSendCommand(e?: React.FormEvent) {
    e?.preventDefault();

    if (!commandInput.trim() || status !== "running") return;

    const cmd = commandInput.trim();
    addConsoleMessage(`> ${cmd}`, "command");

    consoleStore.addCommand(instance.id, cmd);
    setHistoryIndex(-1);
    setCommandInput("");
    setConsoleRefreshKey((k) => k + 1);

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

  // Open folder in file explorer
  async function handleOpenFolder() {
    try {
      const opener = await import("@tauri-apps/plugin-opener");
      // revealItemInDir opens the folder in file explorer and selects it
      await opener.revealItemInDir(instance.path);
    } catch (err) {
      console.error("Failed to open folder:", err);
      // Fallback to openPath
      try {
        const opener = await import("@tauri-apps/plugin-opener");
        await opener.openPath(instance.path);
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
      }
    }
  }

  // Open URL in browser
  async function handleOpenUrl(url: string) {
    try {
      const opener = await import("@tauri-apps/plugin-opener");
      await opener.openUrl(url);
    } catch (err) {
      console.error("Failed to open URL:", err);
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

      // Update local instance state so hasChanges becomes false
      const updatedInstance = {
        ...instance,
        name: settingsForm.name,
        java_path: settingsForm.java_path || null,
        jvm_args: settingsForm.jvm_args || null,
        server_args: settingsForm.server_args || null,
      };
      setInstance(updatedInstance);

      // Notify parent component
      if (onUpdateInstance) {
        onUpdateInstance(updatedInstance);
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

  // Refresh online players
  async function handleRefreshPlayers() {
    try {
      const response = await invoke<OnlinePlayersResponse>("get_online_players", {
        instanceId: instance.id,
      });
      setOnlinePlayers(response.players);
    } catch (err) {
      console.error("Failed to refresh players:", err);
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
              <TabsTrigger value="players" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Players
                {onlinePlayers.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
                    {onlinePlayers.length}
                  </span>
                )}
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
              <TabsTrigger value="files" className="gap-1.5">
                <FileJson className="h-3.5 w-3.5" />
                Files
              </TabsTrigger>
              <TabsTrigger value="worlds" className="gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Worlds
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

          {/* Auth Banner - Phase 1: Needs authentication */}
          {authStatus === "needs_auth" && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-yellow-500">Server requires authentication</span>
                <span className="text-xs text-muted-foreground">Players cannot connect until authenticated</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartAuth}
                disabled={startingAuth}
              >
                {startingAuth ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Start Authentication
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Auth Banner - Phase 2: Waiting for user to enter code */}
          {authStatus === "awaiting_code" && authEvent && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-blue-500">Enter this code:</span>
                <code className="rounded bg-background/50 px-3 py-1 text-lg font-mono font-bold">
                  {authEvent.code}
                </code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenUrl(authEvent.auth_url)}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Open Auth Page
              </Button>
            </div>
          )}

          {/* Auth Banner - Phase 3: Authenticated (briefly shown) */}
          {authStatus === "authenticated" && !needsPersistence && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-green-500">Server authenticated successfully</span>
                <span className="text-xs text-muted-foreground">Players can now connect</span>
              </div>
            </div>
          )}

          {/* Persistence Warning Banner */}
          {needsPersistence && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-orange-500">Credentials in memory only</span>
                <span className="text-xs text-muted-foreground">Save them to persist across restarts</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSavePersistence}
                disabled={savingPersistence}
              >
                {savingPersistence ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Credentials"
                )}
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
              onClear={clearConsole}
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
              systemMetrics={systemMetrics}
              allInstances={allInstances}
              isSaving={isSavingSettings}
              isRunning={isRunning}
              onFormChange={(updates) => setSettingsForm((s) => ({ ...s, ...updates }))}
              onSave={handleSaveSettings}
              onRefreshInstance={reloadInstance}
              onVersionUpdated={(newVersion) => {
                // Update local instance state
                setInstance((prev) => ({ ...prev, installed_version: newVersion }));
                // Notify parent component if callback provided
                if (onUpdateInstance) {
                  onUpdateInstance({ ...instance, installed_version: newVersion });
                }
              }}
            />
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="flex-1 overflow-auto mt-0">
            <MetricsTab
              isRunning={isRunning}
              metrics={metrics}
              metricsHistory={metricsHistory}
              uptime={formatUptime()}
            />
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="flex-1 overflow-auto mt-0">
            <PlayersTab
              isRunning={isRunning}
              players={onlinePlayers}
              onRefresh={handleRefreshPlayers}
            />
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 overflow-auto mt-0">
            <FilesTab instance={instance} serverStatus={status} />
          </TabsContent>

          {/* Worlds Tab */}
          <TabsContent value="worlds" className="flex-1 overflow-auto mt-0">
            <WorldsTab instance={instance} serverStatus={status} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
