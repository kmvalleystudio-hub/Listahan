import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Keyboard,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeContext";
import type { AppThemeColors } from "../theme/colors";

export type AppAlertVariant = "info" | "warning" | "error" | "success";

export type AppAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type ShowAppAlertOptions = {
  title: string;
  message?: string;
  variant?: AppAlertVariant;
  buttons?: AppAlertButton[];
};

type AppAlertContextValue = {
  showAlert: (opts: ShowAppAlertOptions) => void;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

function variantIcon(variant: AppAlertVariant): keyof typeof Ionicons.glyphMap {
  switch (variant) {
    case "error":
      return "alert-circle-outline";
    case "warning":
      return "warning-outline";
    case "success":
      return "checkmark-circle-outline";
    default:
      return "information-circle-outline";
  }
}

function createAlertStyles(c: AppThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      paddingVertical: 24,
      paddingHorizontal: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      gap: 14,
      maxWidth: 400,
      alignSelf: "center",
      width: "100%",
    },
    iconCircle: {
      alignSelf: "center",
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.iconBlobBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    title: {
      fontSize: 19,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      paddingHorizontal: 4,
    },
    messageScroll: { maxHeight: 220 },
    message: {
      fontSize: 15,
      color: c.placeholder,
      lineHeight: 22,
      textAlign: "center",
      paddingHorizontal: 2,
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 4,
      justifyContent: "center",
    },
    btn: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 108,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnPrimary: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    btnGhost: {
      backgroundColor: c.inputBg,
      borderColor: c.border,
    },
    btnGhostText: { color: c.text, fontSize: 16, fontWeight: "700" },
    btnDanger: {
      backgroundColor: `${c.danger}18`,
      borderColor: c.danger,
    },
    btnDangerText: { color: c.danger, fontSize: 16, fontWeight: "800" },
  });
}

function inferVariant(opts: ShowAppAlertOptions): AppAlertVariant {
  if (opts.variant) return opts.variant;
  const t = opts.title.toLowerCase();
  const m = (opts.message ?? "").toLowerCase();
  if (
    t.includes("couldn't") ||
    t.includes("could not") ||
    t.includes("failed") ||
    t.includes("incorrect") ||
    t.includes("error") ||
    t.includes("taken") ||
    m.includes("permission")
  ) {
    return "error";
  }
  if (t.includes("remove") || t.includes("delete") || t.includes("reset")) return "warning";
  if (t.includes("copied") || t.includes("saved") || t.includes("updated")) return "success";
  return "info";
}

/** Modal subtree does not inherit the root SafeAreaProvider; nest one here (see RN Modal + safe-area-context). */
function AppAlertModalInner({
  item,
  onClose,
}: {
  item: ShowAppAlertOptions;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createAlertStyles(colors), [colors]);
  const variant = inferVariant(item);
  const iconName = variantIcon(variant);
  const iconColor =
    variant === "error"
      ? colors.danger
      : variant === "warning"
        ? colors.warningOrange
        : variant === "success"
          ? colors.success
          : colors.primaryDark;

  const buttons: AppAlertButton[] =
    item.buttons && item.buttons.length > 0 ? item.buttons : [{ text: "OK", style: "default" }];

  const runThenClose = (btn: AppAlertButton) => {
    Keyboard.dismiss();
    try {
      btn.onPress?.();
    } finally {
      onClose();
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.backdrop} />
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconName} size={30} color={iconColor} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.message ? (
          <ScrollView style={styles.messageScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.message}>{item.message}</Text>
          </ScrollView>
        ) : null}

        <View style={styles.actionsRow}>
          {buttons.map((btn, i) => {
            const isDestructive = btn.style === "destructive";
            const isCancel = btn.style === "cancel";
            const styleCombo = isDestructive
              ? [styles.btn, styles.btnDanger]
              : isCancel
                ? [styles.btn, styles.btnGhost]
                : [styles.btn, styles.btnPrimary];
            const textStyle = isDestructive
              ? styles.btnDangerText
              : isCancel
                ? styles.btnGhostText
                : styles.btnPrimaryText;
            return (
              <Pressable
                key={`${btn.text}-${i}`}
                style={({ pressed }) => [...styleCombo, pressed && { opacity: 0.88 }]}
                onPress={() => runThenClose(btn)}
                accessibilityRole="button"
                accessibilityLabel={btn.text}
              >
                <Text style={textStyle}>{btn.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function AppAlertModalBody({
  item,
  onClose,
}: {
  item: ShowAppAlertOptions;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <SafeAreaProvider>
        <AppAlertModalInner item={item} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ShowAppAlertOptions[]>([]);

  const showAlert = useCallback((opts: ShowAppAlertOptions) => {
    setQueue((q) => [...q, opts]);
  }, []);

  const closeHead = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const current = queue[0];

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      {current ? <AppAlertModalBody item={current} onClose={closeHead} /> : null}
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): AppAlertContextValue {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error("useAppAlert must be used within AppAlertProvider");
  return ctx;
}
