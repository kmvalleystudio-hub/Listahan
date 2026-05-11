import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { hasStoredPin } from "../utils/privateVaultPin";

type PrivateVaultContextValue = {
  ready: boolean;
  hasPin: boolean;
  unlocked: boolean;
  lock: () => void;
  unlock: () => void;
  refreshHasPin: () => Promise<void>;
};

const PrivateVaultContext = createContext<PrivateVaultContextValue | null>(null);

export function PrivateVaultProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refreshHasPin = useCallback(async () => {
    const h = await hasStoredPin();
    setHasPin(h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (Platform.OS === "web") {
        if (!cancelled) {
          setHasPin(false);
          setUnlocked(true);
          setReady(true);
        }
        return;
      }
      await refreshHasPin();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshHasPin]);

  const lock = useCallback(() => {
    setUnlocked(false);
  }, []);

  const unlock = useCallback(() => {
    setUnlocked(true);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background") {
        setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      hasPin,
      unlocked,
      lock,
      unlock,
      refreshHasPin,
    }),
    [ready, hasPin, unlocked, lock, unlock, refreshHasPin]
  );

  return <PrivateVaultContext.Provider value={value}>{children}</PrivateVaultContext.Provider>;
}

export function usePrivateVault(): PrivateVaultContextValue {
  const ctx = useContext(PrivateVaultContext);
  if (!ctx) {
    throw new Error("usePrivateVault must be used within PrivateVaultProvider");
  }
  return ctx;
}
