import React, { createContext, useContext, useMemo } from "react";
import { useWindowDimensions } from "react-native";

type ViewportSize = { width: number; height: number };

const PreviewViewportContext = createContext<ViewportSize | null>(null);

type ProviderProps = {
  width: number;
  height: number;
  children: React.ReactNode;
};

/** Constrains layout math to the phone frame when running `npm run preview` in a browser. */
export function PreviewViewportProvider({ width, height, children }: ProviderProps) {
  const value = useMemo(() => ({ width, height }), [width, height]);
  return <PreviewViewportContext.Provider value={value}>{children}</PreviewViewportContext.Provider>;
}

/** Device window on native; phone-frame size inside web preview. */
export function useViewportDimensions(): ViewportSize {
  const preview = useContext(PreviewViewportContext);
  const window = useWindowDimensions();
  return preview ?? window;
}
