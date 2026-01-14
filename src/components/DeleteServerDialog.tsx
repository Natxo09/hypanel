import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, AlertTriangle, Trash2, FolderX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Instance, DeleteResult } from "@/lib/types";

interface DeleteServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  onDeleted: (instanceId: string) => void;
  folderMissing?: boolean;
}

export function DeleteServerDialog({
  open,
  onOpenChange,
  instance,
  onDeleted,
  folderMissing = false,
}: DeleteServerDialogProps) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!instance) return;

    setDeleting(true);
    setError(null);

    try {
      const result = await invoke<DeleteResult>("delete_server_instance", {
        id: instance.id,
        deleteFiles: deleteFiles && !folderMissing,
      });

      if (result.success) {
        onDeleted(instance.id);
        onOpenChange(false);
        setDeleteFiles(false);
      } else {
        setError(result.error || "Failed to delete server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!deleting) {
      onOpenChange(open);
      if (!open) {
        setDeleteFiles(false);
        setError(null);
      }
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {folderMissing ? (
              <FolderX className="h-5 w-5 text-yellow-500" />
            ) : (
              <Trash2 className="h-5 w-5 text-destructive" />
            )}
            {folderMissing ? "Server folder missing" : "Delete server"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {folderMissing ? (
                <p>
                  The folder for <span className="font-medium text-foreground">"{instance?.name}"</span> no longer exists on disk.
                  Do you want to remove it from HyPanel?
                </p>
              ) : (
                <p>
                  Are you sure you want to delete <span className="font-medium text-foreground">"{instance?.name}"</span>?
                  This action cannot be undone.
                </p>
              )}

              {!folderMissing && (
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/50">
                  <Checkbox
                    id="delete-files"
                    checked={deleteFiles}
                    onCheckedChange={(checked) => setDeleteFiles(checked === true)}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="delete-files" className="font-medium cursor-pointer">
                      Also delete server files from disk
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This will permanently delete all files in:
                    </p>
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded block truncate">
                      {instance?.path}
                    </code>
                  </div>
                </div>
              )}

              {deleteFiles && !folderMissing && (
                <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">
                    All server files will be permanently deleted!
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className={deleteFiles && !folderMissing ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : folderMissing ? (
              "Remove from HyPanel"
            ) : deleteFiles ? (
              "Delete server and files"
            ) : (
              "Remove from HyPanel"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
