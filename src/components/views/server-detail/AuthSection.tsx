import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  User,
  HardDrive,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Instance } from "@/lib/types";

interface AuthSectionProps {
  instance: Instance;
  isRunning: boolean;
  onRefresh?: () => void;
}

export function AuthSection({ instance, isRunning, onRefresh }: AuthSectionProps) {
  const [isStartingAuth, setIsStartingAuth] = useState(false);
  const [isSavingPersistence, setIsSavingPersistence] = useState(false);

  const authStatus = instance.auth_status || "unknown";
  const authPersistence = instance.auth_persistence || "memory";
  const profileName = instance.auth_profile_name;

  const isAuthenticated = authStatus === "authenticated";
  const isPersisted = authPersistence === "encrypted";

  async function handleStartAuth() {
    if (!isRunning) return;
    setIsStartingAuth(true);

    try {
      await invoke("send_server_command", {
        instanceId: instance.id,
        command: "/auth login device",
      });
    } catch (err) {
      console.error("Failed to start auth:", err);
    } finally {
      setIsStartingAuth(false);
    }
  }

  async function handleSavePersistence() {
    if (!isRunning) return;
    setIsSavingPersistence(true);

    try {
      await invoke("send_server_command", {
        instanceId: instance.id,
        command: "/auth persistence Encrypted",
      });

      await invoke("update_instance_auth_status", {
        instanceId: instance.id,
        authStatus: null,
        authPersistence: "encrypted",
        authProfileName: null,
      });

      onRefresh?.();
    } catch (err) {
      console.error("Failed to save persistence:", err);
    } finally {
      setIsSavingPersistence(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Authentication
        </h3>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid gap-3">
        {/* Auth Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
              isAuthenticated ? "bg-green-500/10" : "bg-yellow-500/10"
            }`}>
              {isAuthenticated ? (
                <ShieldCheck className="h-4 w-4 text-green-500" />
              ) : (
                <ShieldOff className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isAuthenticated ? "Authenticated" : "Not authenticated"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAuthenticated
                  ? "Server can accept player connections"
                  : "Players cannot connect until authenticated"}
              </p>
            </div>
          </div>
          <Badge variant={isAuthenticated ? "default" : "secondary"}>
            {authStatus === "unknown" ? "Unknown" : isAuthenticated ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Profile Info (if authenticated) */}
        {isAuthenticated && profileName && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Profile</p>
                <p className="text-xs text-muted-foreground">Authenticated account</p>
              </div>
            </div>
            <span className="text-sm font-medium">{profileName}</span>
          </div>
        )}

        {/* Persistence Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
              isPersisted ? "bg-green-500/10" : "bg-orange-500/10"
            }`}>
              {isPersisted ? (
                <Lock className="h-4 w-4 text-green-500" />
              ) : (
                <HardDrive className="h-4 w-4 text-orange-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {isPersisted ? "Credentials saved" : "Credentials in memory"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPersisted
                  ? "Encrypted and persisted to disk"
                  : "Will be lost when server restarts"}
              </p>
            </div>
          </div>
          <Badge variant={isPersisted ? "default" : "outline"}>
            {isPersisted ? "Encrypted" : "Memory"}
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {!isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAuth}
            disabled={!isRunning || isStartingAuth}
          >
            {isStartingAuth ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Start Authentication
              </>
            )}
          </Button>
        )}

        {isAuthenticated && !isPersisted && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSavePersistence}
            disabled={!isRunning || isSavingPersistence}
          >
            {isSavingPersistence ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Save Credentials
              </>
            )}
          </Button>
        )}
      </div>

      {!isRunning && (
        <p className="text-xs text-muted-foreground">
          Start the server to manage authentication settings.
        </p>
      )}
    </div>
  );
}
