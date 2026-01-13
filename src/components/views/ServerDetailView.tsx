import { useState } from "react";
import {
  Loader2,
  Play,
  Square,
  FolderOpen,
  Settings,
  Terminal,
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
import { PageHeader } from "@/components/layout/PageHeader";
import type { Instance } from "@/lib/types";

interface ServerDetailViewProps {
  instance: Instance;
  onBack: () => void;
}

export function ServerDetailView({ instance, onBack }: ServerDetailViewProps) {
  const [status, setStatus] = useState<"stopped" | "starting" | "running" | "stopping">("stopped");

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={instance.name} backButton onBack={onBack}>
        <Badge variant={status === "running" ? "default" : "secondary"} className="text-sm">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </PageHeader>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left panel */}
        <div className="flex w-72 shrink-0 flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {status === "stopped" ? (
                <Button className="w-full" onClick={() => setStatus("starting")}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Server
                </Button>
              ) : status === "running" ? (
                <Button className="w-full" variant="destructive" onClick={() => setStatus("stopping")}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Server
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status === "starting" ? "Starting..." : "Stopping..."}
                </Button>
              )}
              <Button className="w-full" variant="outline">
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Folder
              </Button>
              <Button className="w-full" variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Server Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Path</dt>
                  <dd className="font-mono text-xs truncate" title={instance.path}>
                    {instance.path}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{status}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
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
          <CardContent className="flex-1 pb-4">
            <div className="h-full rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-300 overflow-auto">
              {status === "stopped" ? (
                <p className="text-zinc-600">Server is not running. Start the server to see output.</p>
              ) : (
                <p className="text-zinc-600">Waiting for output...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
