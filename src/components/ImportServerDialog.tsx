import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2, AlertCircle, CheckCircle2, Import } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Instance, ServerFilesStatus, InstanceResult } from "@/lib/types";

interface ImportServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: Instance[];
  onServerImported: (instance: Instance) => void;
}

type Step = "select" | "configure" | "importing";

export function ImportServerDialog({
  open,
  onOpenChange,
  instances,
  onServerImported,
}: ImportServerDialogProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [serverName, setServerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Reset state when dialog closes
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setStep("select");
      setSelectedPath(null);
      setServerName("");
      setError(null);
      setIsValidating(false);
    }
    onOpenChange(isOpen);
  }

  async function handleSelectFolder() {
    try {
      const result = await openDialog({
        directory: true,
        multiple: false,
        title: "Select existing server folder",
      });

      if (!result) return;

      setIsValidating(true);
      setError(null);

      // Check if this path is already registered
      const existingInstance = instances.find((i) => i.path === result);
      if (existingInstance) {
        setError(`This folder is already registered as "${existingInstance.name}"`);
        setIsValidating(false);
        return;
      }

      // Check if it's a valid server folder
      const status = await invoke<ServerFilesStatus>("check_server_files", {
        path: result,
      });

      if (!status.has_server_jar) {
        setError("This folder doesn't contain a valid Hytale server. Expected Server/HytaleServer.jar");
        setIsValidating(false);
        return;
      }

      // Valid server found
      setSelectedPath(result);
      // Suggest a name based on folder name
      const folderName = result.split(/[/\\]/).pop() || "My Server";
      setServerName(folderName);
      setStep("configure");
      setIsValidating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select folder");
      setIsValidating(false);
    }
  }

  async function handleImport() {
    if (!selectedPath || !serverName.trim()) return;

    setStep("importing");
    setError(null);

    try {
      // Create the instance in the database
      const result = await invoke<InstanceResult>("create_server_instance", {
        name: serverName.trim(),
        path: selectedPath,
        javaPath: null,
      });

      if (result.success && result.instance) {
        console.log("[ImportServerDialog] Instance created:", result.instance);

        // Close dialog first, then notify parent
        handleOpenChange(false);

        // Small delay to ensure dialog state is reset before updating parent
        setTimeout(() => {
          onServerImported(result.instance!);
        }, 0);
      } else {
        setError(result.error || "Failed to create server instance");
        setStep("configure");
      }
    } catch (err) {
      console.error("[ImportServerDialog] Failed to import:", err);
      setError(err instanceof Error ? err.message : "Failed to import server");
      setStep("configure");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="h-5 w-5" />
            Import Existing Server
          </DialogTitle>
          <DialogDescription>
            Add an existing Hytale server to HyPanel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step: Select Folder */}
          {step === "select" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a folder containing an existing Hytale server with <code className="text-xs bg-muted px-1 py-0.5 rounded">Server/HytaleServer.jar</code>
              </p>

              <Button
                onClick={handleSelectFolder}
                disabled={isValidating}
                className="w-full"
                variant="outline"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Select Server Folder
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step: Configure */}
          {step === "configure" && selectedPath && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm text-green-500 font-medium">Valid server found</p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                    {selectedPath}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="server-name">Server Name</Label>
                <Input
                  id="server-name"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My Server"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Choose a name to identify this server in HyPanel
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("select");
                    setSelectedPath(null);
                    setError(null);
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!serverName.trim()}
                  className="flex-1"
                >
                  Import Server
                </Button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Importing server...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
