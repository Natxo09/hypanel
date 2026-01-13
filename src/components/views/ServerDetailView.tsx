import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Loader2,
  Play,
  Square,
  FolderOpen,
  Settings,
  Terminal,
  Send,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import type {
  Instance,
  ServerStatus,
  ServerStatusInfo,
  ServerOutput,
  StartResult,
  StopResult,
  AuthEvent,
} from "@/lib/types";

interface ServerDetailViewProps {
  instance: Instance;
  onBack: () => void;
}

interface ConsoleMessage {
  id: number;
  text: string;
  type: "stdout" | "stderr" | "system" | "command";
  timestamp: string;
}

export function ServerDetailView({ instance, onBack }: ServerDetailViewProps) {
  const [status, setStatus] = useState<ServerStatus>("stopped");
  const [consoleOutput, setConsoleOutput] = useState<ConsoleMessage[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [authEvent, setAuthEvent] = useState<AuthEvent | null>(null);
  const [pid, setPid] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageIdRef = useRef(0);

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
  }, []);

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

    // Server output
    listen<ServerOutput>("server-output", (event) => {
      if (event.payload.instance_id === instance.id) {
        addConsoleMessage(
          event.payload.line,
          event.payload.stream as "stdout" | "stderr"
        );
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    // Status changes
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

    // Auth required
    listen<AuthEvent>("server-auth-required", (event) => {
      if (event.payload.instance_id === instance.id) {
        setAuthEvent(event.payload);
        addConsoleMessage(
          `Authentication required. Code: ${event.payload.code}`,
          "system"
        );
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    // Auth success
    listen<string>("server-auth-success", (event) => {
      if (event.payload === instance.id) {
        setAuthEvent(null);
        addConsoleMessage("Authentication successful!", "system");
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    // Server exit
    listen<string>("server-exit", (event) => {
      if (event.payload === instance.id) {
        addConsoleMessage("Server process exited", "system");
      }
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [instance.id, addConsoleMessage]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput]);

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

    // Add to history
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

  // Handle key navigation in command input
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex < commandHistory.length - 1
            ? historyIndex + 1
            : historyIndex;
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

  // Get status badge variant
  function getStatusVariant(): "default" | "secondary" | "destructive" {
    switch (status) {
      case "running":
        return "default";
      case "starting":
      case "stopping":
        return "secondary";
      default:
        return "secondary";
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

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={instance.name} backButton onBack={onBack}>
        <Badge variant={getStatusVariant()} className="text-sm">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </PageHeader>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left panel */}
        <div className="flex w-72 shrink-0 flex-col gap-4">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {status === "stopped" ? (
                <Button className="w-full" onClick={handleStart}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Server
                </Button>
              ) : status === "running" ? (
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={handleStop}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Server
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status === "starting" ? "Starting..." : "Stopping..."}
                </Button>
              )}
              <Button className="w-full" variant="outline" onClick={handleOpenFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Folder
              </Button>
              <Button className="w-full" variant="outline" disabled>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </CardContent>
          </Card>

          {/* Server Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Server Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Path</dt>
                  <dd
                    className="font-mono text-xs truncate"
                    title={instance.path}
                  >
                    {instance.path}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{status}</dd>
                </div>
                {pid && (
                  <div>
                    <dt className="text-muted-foreground">PID</dt>
                    <dd className="font-mono">{pid}</dd>
                  </div>
                )}
                {status === "running" && (
                  <div>
                    <dt className="text-muted-foreground">Uptime</dt>
                    <dd>{formatUptime()}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Auth Card */}
          {authEvent && (
            <Card className="border-yellow-500/50 bg-yellow-500/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-yellow-500">
                  Authentication Required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Visit the URL below and enter the code to authenticate your
                  server.
                </p>
                <div className="rounded bg-background/50 p-2 font-mono text-lg text-center">
                  {authEvent.code}
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => window.open(authEvent.auth_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Auth Page
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Console */}
        <Card className="flex flex-1 flex-col min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              <CardTitle className="text-base">Console</CardTitle>
            </div>
            <CardDescription>Server output and command input</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pb-4 min-h-0">
            {/* Output area */}
            <div
              ref={consoleRef}
              className="flex-1 rounded-lg bg-zinc-950 p-4 font-mono text-sm overflow-auto mb-3"
            >
              {consoleOutput.length === 0 ? (
                <p className="text-zinc-600">
                  {status === "stopped"
                    ? "Server is not running. Start the server to see output."
                    : "Waiting for output..."}
                </p>
              ) : (
                consoleOutput.map((msg) => (
                  <div
                    key={msg.id}
                    className={`whitespace-pre-wrap break-all ${
                      msg.type === "stderr"
                        ? "text-red-400"
                        : msg.type === "system"
                        ? "text-yellow-400"
                        : msg.type === "command"
                        ? "text-blue-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>

            {/* Command input */}
            <form onSubmit={handleSendCommand} className="flex gap-2">
              <Input
                ref={inputRef}
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  status === "running"
                    ? "Type a command..."
                    : "Start server to send commands"
                }
                disabled={status !== "running"}
                className="font-mono"
              />
              <Button
                type="submit"
                size="icon"
                disabled={status !== "running" || !commandInput.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {/* Quick commands */}
            {status === "running" && (
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setCommandInput("/help");
                    inputRef.current?.focus();
                  }}
                >
                  /help
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setCommandInput("/auth login device");
                    inputRef.current?.focus();
                  }}
                >
                  /auth login device
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
