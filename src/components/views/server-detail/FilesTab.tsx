import { useState } from "react";
import { FileJson, Shield, Ban, Users, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhitelistEditor } from "./WhitelistEditor";
import { BansEditor } from "./BansEditor";
import { PermissionsEditor } from "./PermissionsEditor";
import { ServerConfigEditor } from "./ServerConfigEditor";
import type { Instance, ServerStatus } from "@/lib/types";

interface FilesTabProps {
  instance: Instance;
  serverStatus: ServerStatus;
}

export function FilesTab({ instance, serverStatus }: FilesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("whitelist");
  const isRunning = serverStatus === "running";

  return (
    <div className="h-full flex flex-col">
      {/* Warning banner when server is running */}
      {isRunning && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-500">
            Server is running. Changes may be overwritten when the server saves. Stop the server before making changes.
          </p>
        </div>
      )}

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="whitelist" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Whitelist
          </TabsTrigger>
          <TabsTrigger value="bans" className="gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            Bans
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <FileJson className="h-3.5 w-3.5" />
            Server Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whitelist" className="flex-1 mt-3">
          <WhitelistEditor instancePath={instance.path} isRunning={isRunning} />
        </TabsContent>

        <TabsContent value="bans" className="flex-1 mt-3">
          <BansEditor instancePath={instance.path} isRunning={isRunning} />
        </TabsContent>

        <TabsContent value="permissions" className="flex-1 mt-3">
          <PermissionsEditor instancePath={instance.path} isRunning={isRunning} />
        </TabsContent>

        <TabsContent value="config" className="flex-1 mt-3">
          <ServerConfigEditor instancePath={instance.path} isRunning={isRunning} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
