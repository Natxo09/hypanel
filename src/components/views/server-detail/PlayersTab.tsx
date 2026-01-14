import { Users, User, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OnlinePlayer } from "@/lib/types";

interface PlayersTabProps {
  isRunning: boolean;
  players: OnlinePlayer[];
  onRefresh?: () => void;
}

function formatConnectionTime(joinedAt: string): string {
  const joined = new Date(joinedAt);
  const now = new Date();
  const diff = Math.floor((now.getTime() - joined.getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function PlayersTab({ isRunning, players, onRefresh }: PlayersTabProps) {
  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Users className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Server is not running</p>
        <p className="text-xs">Start the server to see online players</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {players.length} {players.length === 1 ? "Player" : "Players"} Online
          </span>
        </div>
        {onRefresh && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh player list</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No players online</p>
          <p className="text-xs">Players will appear here when they connect</p>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <PlayerCard key={player.uuid} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PlayerCardProps {
  player: OnlinePlayer;
}

function PlayerCard({ player }: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{player.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {player.uuid}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs">{formatConnectionTime(player.joined_at)}</span>
      </div>
    </div>
  );
}
