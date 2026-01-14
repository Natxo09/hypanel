import { useRef, useEffect, useState, useCallback } from "react";
import {
  Send,
  ArrowDown,
  Search,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsoleLine } from "@/components/ui/log-line";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConsoleMessage } from "@/lib/console-store";

interface ConsoleTabProps {
  consoleOutput: ConsoleMessage[];
  commandInput: string;
  isRunning: boolean;
  status: string;
  onCommandChange: (value: string) => void;
  onSendCommand: (e?: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClear?: () => void;
}

export function ConsoleTab({
  consoleOutput,
  commandInput,
  isRunning,
  status,
  onCommandChange,
  onSendCommand,
  onKeyDown,
  onClear,
}: ConsoleTabProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll state
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (consoleRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);

      // If user scrolls up, disable auto-scroll
      if (!atBottom && autoScroll) {
        setAutoScroll(false);
      }
      // If user scrolls to bottom, re-enable auto-scroll
      if (atBottom && !autoScroll) {
        setAutoScroll(true);
      }
    }
  }, [autoScroll]);

  // Auto-scroll when new messages arrive (if enabled)
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleOutput, autoScroll]);

  // Scroll to bottom button handler
  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
      setAutoScroll(true);
      setIsAtBottom(true);
    }
  };

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];

    consoleOutput.forEach((msg, index) => {
      if (msg.text.toLowerCase().includes(query)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, consoleOutput]);

  // Navigate to search result
  const navigateToResult = useCallback(
    (index: number) => {
      if (searchResults.length === 0 || !consoleRef.current) return;

      const messageIndex = searchResults[index];
      const messageElements = consoleRef.current.querySelectorAll("[data-message-index]");
      const targetElement = Array.from(messageElements).find(
        (el) => el.getAttribute("data-message-index") === String(messageIndex)
      );

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        setAutoScroll(false);
      }
    },
    [searchResults]
  );

  // Navigate search results
  const goToNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    navigateToResult(nextIndex);
  };

  const goToPrevResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    navigateToResult(prevIndex);
  };

  // Toggle search
  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
    }
  };

  // Handle search input keydown
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      toggleSearch();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        goToPrevResult();
      } else {
        goToNextResult();
      }
    }
  };


  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showSearch ? "secondary" : "ghost"}
                  size="sm"
                  onClick={toggleSearch}
                  className="h-7 px-2"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search (Ctrl+F)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Clear console */}
          {onClear && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear console</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-scroll indicator */}
          <span className="text-xs text-muted-foreground">
            {autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
          </span>

          {/* Message count */}
          <span className="text-xs text-muted-foreground">
            {consoleOutput.length} lines
          </span>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-zinc-900 border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search in console..."
            className="h-7 text-sm bg-transparent border-0 focus-visible:ring-0 px-0"
          />
          {searchQuery && (
            <>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {searchResults.length > 0
                  ? `${currentSearchIndex + 1}/${searchResults.length}`
                  : "No results"}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevResult}
                  disabled={searchResults.length === 0}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNextResult}
                  disabled={searchResults.length === 0}
                  className="h-6 w-6 p-0"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-6 w-6 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Console output */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={consoleRef}
          onScroll={handleScroll}
          className="absolute inset-0 rounded-lg bg-zinc-950 p-3 font-mono text-xs overflow-auto selectable"
        >
          {consoleOutput.length === 0 ? (
            <p className="text-zinc-600">
              {status === "stopped"
                ? "Server is not running. Start the server to see output."
                : "Waiting for output..."}
            </p>
          ) : (
            consoleOutput.map((msg, index) => (
              <div
                key={msg.id}
                data-message-index={index}
                className={
                  searchResults.includes(index) && searchResults[currentSearchIndex] === index
                    ? "bg-yellow-500/20 -mx-1 px-1 rounded"
                    : searchResults.includes(index)
                    ? "bg-yellow-500/10 -mx-1 px-1 rounded"
                    : ""
                }
              >
                <ConsoleLine
                  text={msg.text}
                  type={msg.type}
                  searchQuery={searchQuery}
                />
              </div>
            ))
          )}
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={scrollToBottom}
                  className="absolute bottom-3 right-5 h-8 w-8 p-0 rounded-full shadow-lg"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Scroll to bottom</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Command input */}
      <form onSubmit={onSendCommand} className="flex gap-2 mt-2">
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
