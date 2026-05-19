import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { getVaultSyncAllowed, hasStoredPin } from "../utils/privateVaultPin";

type PrivateVaultContextValue = {
  ready: boolean;
  hasPin: boolean;
  unlocked: boolean;
  /** User opted in (via Vault settings + PIN) to include Vault in user sync. */
  vaultSyncAllowed: boolean;
  /** @deprecated Use vaultSyncAllowed. Kept so stale Metro bundles do not crash on hot reload. */
  vaultUnlocked: boolean;
  lock: () => void;
  unlock: () => void;
  refreshHasPin: () => Promise<void>;
  refreshVaultSyncAllowed: () => Promise<void>;
};

const PrivateVaultContext = createContext<PrivateVaultContextValue | null>(null);

export function PrivateVaultProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [vaultSyncAllowed, setVaultSyncAllowed] = useState(false);

  const refreshHasPin = useCallback(async () => {
    const h = await hasStoredPin();
    setHasPin(h);
  }, []);

  const refreshVaultSyncAllowed = useCallback(async () => {
    const allowed = await getVaultSyncAllowed();
    setVaultSyncAllowed(allowed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (Platform.OS === "web") {
        if (!cancelled) {
          setHasPin(false);
          setUnlocked(true);
          setVaultSyncAllowed(false);
          setReady(true);
        }
        return;
      }
      await Promise.all([refreshHasPin(), refreshVaultSyncAllowed()]);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshHasPin, refreshVaultSyncAllowed]);

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
      vaultSyncAllowed,
      vaultUnlocked: vaultSyncAllowed,
      lock,
      unlock,
      refreshHasPin,
      refreshVaultSyncAllowed,
    }),
    [ready, hasPin, unlocked, vaultSyncAllowed, lock, unlock, refreshHasPin, refreshVaultSyncAllowed]
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
