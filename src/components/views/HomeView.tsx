import { Server, Plus, Layers, Activity, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Instance } from "@/lib/types";

interface HomeViewProps {
  instances: Instance[];
  onSelectInstance: (instance: Instance) => void;
  onAddInstance: () => void;
  onViewAllServers: () => void;
}

export function HomeView({
  instances,
  onSelectInstance,
  onAddInstance,
  onViewAllServers,
}: HomeViewProps) {
  const runningCount = 0;
  const stoppedCount = instances.length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Dashboard">
        <Button onClick={onAddInstance}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Layers className="h-3.5 w-3.5" />
                <span className="text-sm">Total Servers</span>
              </div>
              <p className="text-3xl font-bold">{instances.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Activity className="h-3.5 w-3.5" />
                <span className="text-sm">Running</span>
              </div>
              <p className="text-3xl font-bold text-green-500">{runningCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Power className="h-3.5 w-3.5" />
                <span className="text-sm">Stopped</span>
              </div>
              <p className="text-3xl font-bold">{stoppedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick access servers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium">Recent Servers</h2>
            <Button variant="link" size="sm" className="text-muted-foreground" onClick={onViewAllServers}>
              View all →
            </Button>
          </div>

          {instances.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Server className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-base font-medium mb-1">No servers yet</p>
                <p className="text-sm text-muted-foreground mb-4">Create your first server to get started</p>
                <Button onClick={onAddInstance}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Server
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {instances.slice(0, 6).map((instance) => (
                <Card
                  key={instance.id}
                  className="cursor-pointer transition-all hover:bg-muted/80 hover:border-muted-foreground/20"
                  onClick={() => onSelectInstance(instance)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Server className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{instance.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{instance.path}</p>
                      </div>
                      <Badge variant="secondary">Stopped</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
