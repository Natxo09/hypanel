import { Copy, Check, Terminal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommandPreviewProps {
  javaPath: string;
  jvmArgs: string;
  serverArgs: string;
}

export function CommandPreview({
  javaPath,
  jvmArgs,
  serverArgs,
}: CommandPreviewProps) {
  const [copied, setCopied] = useState(false);

  // Build the full command preview
  const parts: string[] = [];

  // Java executable
  parts.push(javaPath || "java");

  // JVM arguments
  if (jvmArgs.trim()) {
    parts.push(jvmArgs.trim());
  }

  // The jar file (always present)
  parts.push("-jar Server/HytaleServer.jar");

  // Server arguments
  if (serverArgs.trim()) {
    parts.push(serverArgs.trim());
  }

  const fullCommand = parts.join(" ");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlight the command
  const highlightCommand = () => {
    const tokens: { text: string; type: "executable" | "arg" | "value" | "jar" }[] = [];
    const words = fullCommand.split(/\s+/);
    let i = 0;

    while (i < words.length) {
      const word = words[i];

      if (i === 0) {
        // Java executable
        tokens.push({ text: word, type: "executable" });
      } else if (word === "-jar") {
        tokens.push({ text: word, type: "arg" });
        if (words[i + 1]) {
          i++;
          tokens.push({ text: words[i], type: "jar" });
        }
      } else if (word.startsWith("-")) {
        tokens.push({ text: word, type: "arg" });
        // Check if next word is a value (doesn't start with -)
        if (words[i + 1] && !words[i + 1].startsWith("-")) {
          i++;
          tokens.push({ text: words[i], type: "value" });
        }
      } else {
        tokens.push({ text: word, type: "value" });
      }
      i++;
    }

    return tokens;
  };

  const tokens = highlightCommand();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          Command Preview
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? "Copied!" : "Copy command"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="rounded-md bg-zinc-950 border p-3 overflow-x-auto">
        <code className="text-xs font-mono whitespace-pre-wrap break-all">
          {tokens.map((token, idx) => (
            <span
              key={idx}
              className={
                token.type === "executable"
                  ? "text-green-400"
                  : token.type === "arg"
                  ? "text-cyan-400"
                  : token.type === "jar"
                  ? "text-yellow-400"
                  : "text-orange-300"
              }
            >
              {token.text}
              {idx < tokens.length - 1 ? " " : ""}
            </span>
          ))}
        </code>
      </div>

      <p className="text-xs text-muted-foreground">
        This is the command that will be executed when you start the server.
      </p>
    </div>
  );
}
