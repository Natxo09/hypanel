import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FirewallInfo {
  os: string;
  firewall_type: string | null;
  firewall_enabled: boolean;
  rule_exists: boolean;
  rule_name: string;
  port: number;
  command_to_add: string;
  command_to_remove: string;
  error: string | null;
}

interface FirewallResult {
  success: boolean;
  message: string;
  error: string | null;
}

interface NetworkSectionProps {
  serverName: string;
  port: number;
}

export function NetworkSection({ serverName, port }: NetworkSectionProps) {
  const [firewallInfo, setFirewallInfo] = useState<FirewallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<FirewallResult | null>(null);

  useEffect(() => {
    loadFirewallInfo();
  }, [port, serverName]);

  async function loadFirewallInfo() {
    setLoading(true);
    setResult(null);
    try {
      const info = await invoke<FirewallInfo>("get_firewall_info", {
        port,
        serverName,
      });
      setFirewallInfo(info);
    } catch (err) {
      console.error("Failed to get firewall info:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfigureFirewall() {
    if (!firewallInfo) return;

    setConfiguring(true);
    setResult(null);

    try {
      const res = await invoke<FirewallResult>("add_firewall_rule", {
        port,
        serverName,
      });
      setResult(res);
      if (res.success) {
        // Reload firewall info to reflect changes
        await loadFirewallInfo();
      }
    } catch (err) {
      setResult({
        success: false,
        message: "Failed to configure firewall",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConfiguring(false);
    }
  }

  async function copyCommand() {
    if (!firewallInfo?.command_to_add) return;
    await navigator.clipboard.writeText(firewallInfo.command_to_add);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Network
        </h3>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!firewallInfo) {
    return null;
  }

  const isWindows = firewallInfo.os === "windows";
  const canAutoConfig = isWindows && !firewallInfo.error;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Network
      </h3>

      {/* Firewall Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          {!firewallInfo.firewall_enabled ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : firewallInfo.rule_exists ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10">
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-500/10">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium">
              {!firewallInfo.firewall_enabled
                ? "Firewall disabled"
                : firewallInfo.rule_exists
                  ? "Firewall configured"
                  : "Firewall not configured"}
            </p>
            <p className="text-xs text-muted-foreground">
              UDP port {port} • {firewallInfo.firewall_type || "Unknown firewall"}
            </p>
          </div>
        </div>

        <Badge
          variant={
            !firewallInfo.firewall_enabled
              ? "outline"
              : firewallInfo.rule_exists
                ? "default"
                : "secondary"
          }
        >
          {!firewallInfo.firewall_enabled
            ? "Disabled"
            : firewallInfo.rule_exists
              ? "Open"
              : "Blocked"}
        </Badge>
      </div>

      {/* Configure Button (Windows) or Command (Linux/Mac) */}
      {!firewallInfo.rule_exists && (
        <div className="space-y-2">
          {!firewallInfo.firewall_enabled && (
            <p className="text-xs text-muted-foreground">
              Firewall is disabled. You can still create a rule for when it's enabled.
            </p>
          )}

          {canAutoConfig ? (
            <Button
              onClick={handleConfigureFirewall}
              disabled={configuring}
              className="w-full"
              variant="outline"
            >
              {configuring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Configuring...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {firewallInfo.firewall_enabled
                    ? `Open firewall for UDP ${port}`
                    : `Create rule for UDP ${port}`}
                </>
              )}
            </Button>
          ) : firewallInfo.command_to_add ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Run this command to {firewallInfo.firewall_enabled ? "open" : "configure"} the firewall:
              </p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 rounded bg-muted font-mono text-xs overflow-x-auto">
                  {firewallInfo.command_to_add}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={copyCommand}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {firewallInfo.error && (
            <p className="text-xs text-yellow-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {firewallInfo.error}
            </p>
          )}
        </div>
      )}

      {/* Result message */}
      {result && (
        <div
          className={`p-2 rounded text-xs flex items-center gap-2 ${
            result.success
              ? "bg-green-500/10 text-green-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {result.success ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {result.message}
        </div>
      )}

      {/* Port Forwarding Info */}
      <div className="p-3 rounded-lg border border-dashed space-y-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium">Port Forwarding Required</p>
            <p className="text-xs text-muted-foreground">
              For players outside your network to connect, configure port forwarding on your router:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>Forward <strong>UDP</strong> port {port} (not TCP)</li>
              <li>Point to this computer's local IP</li>
              <li>NAT type may affect connectivity</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
