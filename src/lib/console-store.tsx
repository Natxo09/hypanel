import { createContext, useContext, useCallback, useRef, type ReactNode } from "react";

export interface ConsoleMessage {
  id: number;
  text: string;
  type: "stdout" | "stderr" | "system" | "command";
  timestamp: string;
}

interface InstanceConsoleState {
  messages: ConsoleMessage[];
  commandHistory: string[];
  messageIdCounter: number;
}

interface ConsoleStoreContextValue {
  getMessages: (instanceId: string) => ConsoleMessage[];
  addMessage: (instanceId: string, text: string, type: ConsoleMessage["type"]) => void;
  clearMessages: (instanceId: string) => void;
  getCommandHistory: (instanceId: string) => string[];
  addCommand: (instanceId: string, command: string) => void;
}

const ConsoleStoreContext = createContext<ConsoleStoreContextValue | null>(null);

const MAX_MESSAGES = 2000;
const MAX_COMMAND_HISTORY = 100;

export function ConsoleStoreProvider({ children }: { children: ReactNode }) {
  // Use ref to avoid re-renders when updating the store
  const storeRef = useRef<Map<string, InstanceConsoleState>>(new Map());

  const getOrCreateState = useCallback((instanceId: string): InstanceConsoleState => {
    let state = storeRef.current.get(instanceId);
    if (!state) {
      state = {
        messages: [],
        commandHistory: [],
        messageIdCounter: 0,
      };
      storeRef.current.set(instanceId, state);
    }
    return state;
  }, []);

  const getMessages = useCallback((instanceId: string): ConsoleMessage[] => {
    return getOrCreateState(instanceId).messages;
  }, [getOrCreateState]);

  const addMessage = useCallback((instanceId: string, text: string, type: ConsoleMessage["type"]) => {
    const state = getOrCreateState(instanceId);
    const newMessage: ConsoleMessage = {
      id: state.messageIdCounter++,
      text,
      type,
      timestamp: new Date().toISOString(),
    };

    state.messages = [...state.messages, newMessage];

    // Limit messages to prevent memory issues
    if (state.messages.length > MAX_MESSAGES) {
      state.messages = state.messages.slice(-MAX_MESSAGES);
    }
  }, [getOrCreateState]);

  const clearMessages = useCallback((instanceId: string) => {
    const state = getOrCreateState(instanceId);
    state.messages = [];
    state.messageIdCounter = 0;
  }, [getOrCreateState]);

  const getCommandHistory = useCallback((instanceId: string): string[] => {
    return getOrCreateState(instanceId).commandHistory;
  }, [getOrCreateState]);

  const addCommand = useCallback((instanceId: string, command: string) => {
    const state = getOrCreateState(instanceId);
    // Remove duplicate and add to end
    state.commandHistory = [
      ...state.commandHistory.filter((c) => c !== command),
      command,
    ].slice(-MAX_COMMAND_HISTORY);
  }, [getOrCreateState]);

  const value: ConsoleStoreContextValue = {
    getMessages,
    addMessage,
    clearMessages,
    getCommandHistory,
    addCommand,
  };

  return (
    <ConsoleStoreContext.Provider value={value}>
      {children}
    </ConsoleStoreContext.Provider>
  );
}

export function useConsoleStore() {
  const context = useContext(ConsoleStoreContext);
  if (!context) {
    throw new Error("useConsoleStore must be used within a ConsoleStoreProvider");
  }
  return context;
}
