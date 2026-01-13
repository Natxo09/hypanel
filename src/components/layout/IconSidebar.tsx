import {
  LayoutDashboard,
  Server,
  HardDrive,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import logoImg from "@/assets/logo.png";

export type View = "home" | "servers" | "server" | "backups" | "settings";

interface IconSidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export function IconSidebar({ currentView, onViewChange }: IconSidebarProps) {
  return (
    <div className="flex h-full w-14 flex-col items-center border-r bg-sidebar py-3">
      {/* Logo */}
      <div className="mb-6 flex h-10 w-10 items-center justify-center">
        <img src={logoImg} alt="HyPanel" className="h-9 w-9" />
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex flex-1 flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 ${currentView === "home" ? "text-[#ecbc62]" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
                onClick={() => onViewChange("home")}
              >
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 ${currentView === "servers" || currentView === "server" ? "text-[#ecbc62]" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
                onClick={() => onViewChange("servers")}
              >
                <Server className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Servers</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 opacity-50 ${currentView === "backups" ? "text-[#ecbc62]" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
                onClick={() => onViewChange("backups")}
              >
                <HardDrive className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Backups</TooltipContent>
          </Tooltip>
        </nav>

        {/* Bottom */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-10 w-10 ${currentView === "settings" ? "text-[#ecbc62]" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
                onClick={() => onViewChange("settings")}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
