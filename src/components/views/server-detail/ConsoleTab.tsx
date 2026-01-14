import { useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsoleLine } from "@/components/ui/log-line";
import type { ConsoleMessage } from "@/lib/console-store";

interface ConsoleTabProps {
  consoleOutput: ConsoleMessage[];
  commandInput: string;
  isRunning: boolean;
  status: string;
  onCommandChange: (value: string) => void;
  onSendCommand: (e?: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function ConsoleTab({
  consoleOutput,
  commandInput,
  isRunning,
  status,
  onCommandChange,
  onSendCommand,
  onKeyDown,
}: ConsoleTabProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput]);

  return (
    <>
      <div
        ref={consoleRef}
        className="flex-1 rounded-lg bg-zinc-950 p-3 font-mono text-xs overflow-auto mb-2 selectable"
      >
        {consoleOutput.length === 0 ? (
          <p className="text-zinc-600">
            {status === "stopped"
              ? "Server is not running. Start the server to see output."
              : "Waiting for output..."}
          </p>
        ) : (
          consoleOutput.map((msg) => (
            <ConsoleLine
              key={msg.id}
              text={msg.text}
              type={msg.type}
            />
          ))
        )}
      </div>

      <form onSubmit={onSendCommand} className="flex gap-2">
        <Input
          ref={inputRef}
          value={commandInput}
          onChange={(e) => onCommandChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isRunning ? "Type a command..." : "Start server to send commands"}
          disabled={!isRunning}
          className="font-mono text-sm"
        />
        <Button type="submit" size="icon" disabled={!isRunning || !commandInput.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
