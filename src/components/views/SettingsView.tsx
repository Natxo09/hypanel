import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, CheckCircle, ArrowUpCircle, Download } from "lucide-react";
import { useUpdater } from "@/hooks/useUpdater";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import type { VersionSettings, VersionCheckResult } from "@/lib/types";

export function SettingsView() {
  const {
    checking: appChecking,
    available: appUpdateAvailable,
    downloading: appDownloading,
    progress: appProgress,
    update: appUpdate,
    upToDate: appUpToDate,
    checkForUpdates: checkAppUpdates,
    downloadAndInstall: installAppUpdate,
  } = useUpdater(false);

  const [settings, setSettings] = useState<VersionSettings>({
    check_on_startup: true,
    check_periodic: false,
    check_on_server_start: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    availableVersion: string | null;
    outdatedServers: { id: string; name: string; installedVersion: string | null; versionUnknown: boolean }[];
    unknownCount: number;
    totalCount: number;
  } | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await invoke<VersionSettings>("get_version_settings");
        setSettings(data);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings when changed
  const handleSettingChange = async (key: keyof VersionSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaving(true);

    try {
      await invoke("set_version_settings", { settings: newSettings });
    } catch (err) {
      console.error("Failed to save settings:", err);
      // Revert on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  // Manual version check
  const handleCheckNow = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const results = await invoke<VersionCheckResult[]>("check_all_versions");
      const outdatedServers = results
        .filter(r => r.update_available || r.version_unknown)
        .map(r => ({
          id: r.instance_id,
          name: r.instance_name,
          installedVersion: r.installed_version,
          versionUnknown: r.version_unknown,
        }));
      const unknownCount = results.filter(r => r.version_unknown).length;
      const availableVersion = results.length > 0 ? results[0].available_version : null;
      setCheckResult({
        availableVersion,
        outdatedServers,
        unknownCount,
        totalCount: results.length,
      });
    } catch (err) {
      console.error("Failed to check versions:", err);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Settings" />
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Updates</CardTitle>
            <CardDescription>
              Check for HyPanel application updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Current version</p>
                <p className="text-xs text-muted-foreground font-mono">
                  v{__APP_VERSION__}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkAppUpdates}
                disabled={appChecking || appDownloading}
              >
                {appChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check for updates
                  </>
                )}
              </Button>
            </div>

            {appUpdateAvailable && appUpdate && (
              <div className="rounded-lg p-3 bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-blue-100">
                        Update available: v{appUpdate.version}
                      </p>
                    </div>
                  </div>
                  {appDownloading ? (
                    <div className="flex items-center gap-2 text-xs text-blue-300">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {appProgress}%
                    </div>
                  ) : (
                    <Button size="sm" className="h-7 text-xs" onClick={installAppUpdate}>
                      <Download className="h-3 w-3 mr-1.5" />
                      Install
                    </Button>
                  )}
                </div>
                {appDownloading && (
                  <div className="mt-2 h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${appProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {appUpToDate && (
              <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <p className="text-sm font-medium text-green-100">
                    You're up to date
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Server Version Checking</CardTitle>
            <CardDescription>
              Configure automatic update checks for server versions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="check-startup" className="text-sm font-medium">
                  Check on startup
                </Label>
                <p className="text-xs text-muted-foreground">
                  Check for updates when HyPanel starts
                </p>
              </div>
              <Switch
                id="check-startup"
                checked={settings.check_on_startup}
                onCheckedChange={(checked) => handleSettingChange("check_on_startup", checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="check-periodic" className="text-sm font-medium">
                  Periodic checks
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically check for updates every 30 minutes
                </p>
              </div>
              <Switch
                id="check-periodic"
                checked={settings.check_periodic}
                onCheckedChange={(checked) => handleSettingChange("check_periodic", checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="check-server-start" className="text-sm font-medium">
                  Check before server start
                </Label>
                <p className="text-xs text-muted-foreground">
                  Warn if a server is outdated before starting it
                </p>
              </div>
              <Switch
                id="check-server-start"
                checked={settings.check_on_server_start}
                onCheckedChange={(checked) => handleSettingChange("check_on_server_start", checked)}
                disabled={saving}
              />
            </div>

            <div className="pt-4 border-t space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckNow}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check for updates now
                  </>
                )}
              </Button>

              {checkResult && (
                <div className={`rounded-lg p-3 text-sm ${
                  checkResult.outdatedServers.length > 0
                    ? checkResult.unknownCount === checkResult.outdatedServers.length
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-blue-500/10 border border-blue-500/30"
                    : "bg-green-500/10 border border-green-500/30"
                }`}>
                  {checkResult.outdatedServers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <ArrowUpCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                          checkResult.unknownCount === checkResult.outdatedServers.length ? "text-yellow-400" : "text-blue-400"
                        }`} />
                        <div>
                          <p className={`font-medium ${
                            checkResult.unknownCount === checkResult.outdatedServers.length ? "text-yellow-100" : "text-blue-100"
                          }`}>
                            {checkResult.unknownCount === checkResult.outdatedServers.length
                              ? "Version verification needed"
                              : `Update available: v${checkResult.availableVersion}`}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            checkResult.unknownCount === checkResult.outdatedServers.length ? "text-yellow-300" : "text-blue-300"
                          }`}>
                            {checkResult.outdatedServers.length} of {checkResult.totalCount} server{checkResult.totalCount !== 1 ? "s" : ""} need attention
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 pl-6">
                        {checkResult.outdatedServers.map((server) => (
                          <div key={server.id} className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${server.versionUnknown ? "text-yellow-200" : "text-blue-200"}`}>
                              {server.name}
                            </span>
                            <span className={`font-mono ${server.versionUnknown ? "text-yellow-300/70" : "text-blue-300/70"}`}>
                              {server.versionUnknown
                                ? "unknown"
                                : `${server.installedVersion} → ${checkResult.availableVersion}`}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className={`text-xs mt-2 pl-6 ${
                        checkResult.unknownCount === checkResult.outdatedServers.length ? "text-yellow-300/60" : "text-blue-300/60"
                      }`}>
                        Go to Servers and use the context menu to update each server.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      <div>
                        <p className="font-medium text-green-100">All servers up to date</p>
                        {checkResult.availableVersion && (
                          <p className="text-xs text-green-300 mt-0.5">
                            Latest version: v{checkResult.availableVersion}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
