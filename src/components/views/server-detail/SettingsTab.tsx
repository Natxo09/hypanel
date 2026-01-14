import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Instance } from "@/lib/types";

interface SettingsFormState {
  name: string;
  java_path: string;
  jvm_args: string;
  server_args: string;
}

interface SettingsTabProps {
  instance: Instance;
  settingsForm: SettingsFormState;
  isSaving: boolean;
  onFormChange: (updates: Partial<SettingsFormState>) => void;
  onSave: () => void;
}

export function SettingsTab({
  instance,
  settingsForm,
  isSaving,
  onFormChange,
  onSave,
}: SettingsTabProps) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="text-sm font-medium">Server Configuration</h3>

        <div className="space-y-2">
          <Label htmlFor="name">Server Name</Label>
          <Input
            id="name"
            value={settingsForm.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="java_path">Java Path</Label>
          <Input
            id="java_path"
            value={settingsForm.java_path}
            onChange={(e) => onFormChange({ java_path: e.target.value })}
            placeholder="java (uses system default)"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Path to Java executable. Leave empty to use system default.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jvm_args">JVM Arguments</Label>
          <Input
            id="jvm_args"
            value={settingsForm.jvm_args}
            onChange={(e) => onFormChange({ jvm_args: e.target.value })}
            placeholder="-Xmx4G -Xms2G"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Arguments passed to the JVM (memory, GC settings, etc.)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="server_args">Server Arguments</Label>
          <Input
            id="server_args"
            value={settingsForm.server_args}
            onChange={(e) => onFormChange({ server_args: e.target.value })}
            placeholder="--port 25565"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Additional arguments passed to the server.
          </p>
        </div>

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium">Server Info</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Instance ID</dt>
            <dd className="font-mono text-xs">{instance.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Path</dt>
            <dd className="font-mono text-xs truncate max-w-[300px]" title={instance.path}>
              {instance.path}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-xs">
              {instance.created_at
                ? new Date(instance.created_at).toLocaleDateString()
                : "-"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
