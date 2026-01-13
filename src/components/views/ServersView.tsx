import { Server, Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Instance } from "@/lib/types";

interface ServersViewProps {
  instances: Instance[];
  onSelectInstance: (instance: Instance) => void;
  onAddInstance: () => void;
}

export function ServersView({
  instances,
  onSelectInstance,
  onAddInstance,
}: ServersViewProps) {
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Path</TableHead>
                  <TableHead className="hidden lg:table-cell">Players</TableHead>
                  <TableHead className="hidden lg:table-cell">Uptime</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow
                    key={instance.id}
                    className="cursor-pointer"
                    onClick={() => onSelectInstance(instance)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <Server className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium">{instance.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Stopped</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-muted-foreground font-mono text-xs truncate block max-w-[250px]">
                        {instance.path}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Start server
                        }}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
