import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, Play, Server, Settings, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Instance, InstancesListResult } from "@/lib/types";

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstances();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6" />
            <h1 className="text-xl font-bold">HyPanel</h1>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Server Instances</h2>
          <p className="text-muted-foreground">Manage your Hytale server instances</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-destructive/10 border-destructive/20 text-destructive">
            {error}
          </div>
        )}

        {instances.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No instances found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first server instance to get started
              </p>
              <Button>
                Create Instance
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((instance) => (
              <Card key={instance.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{instance.name}</CardTitle>
                    <Badge variant="secondary">Stopped</Badge>
                  </div>
                  <CardDescription className="truncate text-xs">
                    {instance.path}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1">
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                    <Button size="sm" variant="outline">
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
