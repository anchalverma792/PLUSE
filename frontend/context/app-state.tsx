"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type Environment = "production" | "staging" | "development";

type AppState = {
  environment: Environment;
  setEnvironment: (environment: Environment) => void;
  search: string;
  setSearch: (search: string) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment>("production");
  const [search, setSearch] = useState("");

  const value = useMemo(
    () => ({ environment, setEnvironment, search, setSearch }),
    [environment, search],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return context;
}
