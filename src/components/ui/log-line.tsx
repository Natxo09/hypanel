import { useMemo } from "react";

export type LogLevel = "INFO" | "WARN" | "SEVERE" | "DEBUG" | "ERROR" | "TRACE";

export interface ParsedLog {
  timestamp?: string;
  level?: LogLevel;
  module?: string;
  message: string;
  raw: string;
}

// Strip ANSI escape codes from text
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

// Parse Hytale server log format: [YYYY/MM/DD HH:MM:SS   LEVEL]           [Module] Message
const LOG_REGEX = /^\[(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\]\s*\[([^\]]+)\]\s*(.*)$/;

export function parseLogLine(line: string): ParsedLog {
  // Strip ANSI codes before parsing
  const cleanLine = stripAnsi(line);
  const match = cleanLine.match(LOG_REGEX);

  if (match) {
    const [, timestamp, level, module, message] = match;
    return {
      timestamp,
      level: level as LogLevel,
      module,
      message,
      raw: line,
    };
  }

  return { message: cleanLine, raw: line };
}

const levelColors: Record<LogLevel, string> = {
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  SEVERE: "text-red-400",
  ERROR: "text-red-400",
  DEBUG: "text-zinc-500",
  TRACE: "text-zinc-600",
};

const levelBgColors: Record<LogLevel, string> = {
  INFO: "bg-blue-500/10",
  WARN: "bg-yellow-500/10",
  SEVERE: "bg-red-500/10",
  ERROR: "bg-red-500/10",
  DEBUG: "bg-zinc-500/10",
  TRACE: "bg-zinc-600/10",
};

interface LogLineProps {
  line: string;
  showTimestamp?: boolean;
  className?: string;
}

export function LogLine({ line, showTimestamp = true, className = "" }: LogLineProps) {
  const parsed = useMemo(() => parseLogLine(line), [line]);

  // If it's not a structured log line, render as plain text
  if (!parsed.level) {
    return (
      <div className={`whitespace-pre-wrap break-all leading-relaxed text-zinc-300 ${className}`}>
        {line}
      </div>
    );
  }

  const levelColor = levelColors[parsed.level] || "text-zinc-300";
  const bgColor = levelBgColors[parsed.level] || "";

  return (
    <div className={`whitespace-pre-wrap break-all leading-relaxed flex gap-2 ${bgColor} ${className}`}>
      {showTimestamp && parsed.timestamp && (
        <span className="text-zinc-600 shrink-0 tabular-nums">
          {parsed.timestamp}
        </span>
      )}
      <span className={`shrink-0 w-14 text-right font-medium ${levelColor}`}>
        {parsed.level}
      </span>
      <span className="text-purple-400 shrink-0">
        [{parsed.module}]
      </span>
      <span className="text-zinc-300">
        {parsed.message}
      </span>
    </div>
  );
}

// Compact version for console output (without full timestamp parsing, just colorize)
interface ConsoleLineProps {
  text: string;
  type: "stdout" | "stderr" | "system" | "command";
  className?: string;
}

export function ConsoleLine({ text, type, className = "" }: ConsoleLineProps) {
  // For stdout, try to parse as Hytale log
  if (type === "stdout") {
    const parsed = parseLogLine(text);

    if (parsed.level) {
      const levelColor = levelColors[parsed.level] || "text-zinc-300";
      const bgColor = parsed.level === "SEVERE" || parsed.level === "ERROR"
        ? "bg-red-500/5"
        : parsed.level === "WARN"
        ? "bg-yellow-500/5"
        : "";

      return (
        <div className={`whitespace-pre-wrap break-all leading-relaxed py-0.5 ${bgColor} ${className}`}>
          <span className="text-zinc-600">[{parsed.timestamp}]</span>
          {" "}
          <span className={`font-medium ${levelColor}`}>{parsed.level}</span>
          {" "}
          <span className="text-purple-400">[{parsed.module}]</span>
          {" "}
          <span className="text-zinc-300">{parsed.message}</span>
        </div>
      );
    }

    // Plain stdout without Hytale format - use parsed.message which has ANSI stripped
    return (
      <div className={`whitespace-pre-wrap break-all leading-relaxed text-zinc-300 ${className}`}>
        {parsed.message}
      </div>
    );
  }

  // Other types (stderr, system, command) - strip ANSI codes
  const cleanText = stripAnsi(text);
  const typeColors: Record<string, string> = {
    stderr: "text-red-400 bg-red-500/5",
    system: "text-cyan-400",
    command: "text-emerald-400",
  };

  return (
    <div className={`whitespace-pre-wrap break-all leading-relaxed py-0.5 ${typeColors[type]} ${className}`}>
      {cleanText}
    </div>
  );
}
