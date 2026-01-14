import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";

type Platform = "macos" | "windows" | "linux";

function detectPlatform(): Platform {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("linux")) return "linux";
  return "windows";
}

interface WindowControlsProps {
  platform: Platform;
}

function WindowControls({ platform }: WindowControlsProps) {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for window resize to update maximized state
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  // macOS style (traffic lights on the left)
  if (platform === "macos") {
    return (
      <div className="flex items-center gap-2 ml-3 macos-controls">
        <button
          onClick={handleClose}
          className="w-3 h-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 flex items-center justify-center group transition-colors"
          aria-label="Close"
        >
          <X className="w-2 h-2 text-[#ff5f57] group-hover:text-[#4d0000] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          onClick={handleMinimize}
          className="w-3 h-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 flex items-center justify-center group transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-2 h-2 text-[#febc2e] group-hover:text-[#5c4500] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-3 h-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 flex items-center justify-center group transition-colors"
          aria-label="Maximize"
        >
          {isMaximized ? (
            <Copy className="w-2 h-2 text-[#28c840] group-hover:text-[#0a4d12] opacity-0 group-hover:opacity-100 transition-opacity rotate-90" />
          ) : (
            <Square className="w-1.5 h-1.5 text-[#28c840] group-hover:text-[#0a4d12] opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>
    );
  }

  // Windows/Linux style (buttons on the right)
  return (
    <div className="flex items-center h-full">
      <button
        onClick={handleMinimize}
        className="h-8 w-8 hover:bg-white/10 flex items-center justify-center transition-colors"
        aria-label="Minimize"
      >
        <Minus className="w-4 h-4 text-sidebar-foreground/80" />
      </button>
      <button
        onClick={handleMaximize}
        className="h-8 w-8 hover:bg-white/10 flex items-center justify-center transition-colors"
        aria-label="Maximize"
      >
        {isMaximized ? (
          <Copy className="w-3.5 h-3.5 text-sidebar-foreground/80" />
        ) : (
          <Square className="w-3 h-3 text-sidebar-foreground/80" />
        )}
      </button>
      <button
        onClick={handleClose}
        className="h-8 w-8 hover:bg-[#e81123] flex items-center justify-center transition-colors group"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-sidebar-foreground/80 group-hover:text-white" />
      </button>
    </div>
  );
}

interface WindowTitlebarProps {
  showTitle?: boolean;
  title?: string;
}

export function WindowTitlebar({ showTitle = false, title = "HyPanel" }: WindowTitlebarProps) {
  // Detect platform immediately to avoid flash
  const [platform] = useState<Platform>(() => detectPlatform());

  // Only show custom titlebar on Windows (macOS and Linux use native decorations)
  if (platform !== "windows") {
    return null;
  }

  return (
    <div
      className="window-titlebar h-8 bg-sidebar flex items-center select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Drag region / Title */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center px-4"
      >
        {showTitle && (
          <span className="text-xs text-sidebar-foreground/60 font-medium">
            {title}
          </span>
        )}
      </div>

      {/* Windows: Controls on the right */}
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <WindowControls platform={platform} />
      </div>
    </div>
  );
}
