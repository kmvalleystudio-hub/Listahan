import "./src/theme/installStyleSheetScale";
import "react-native-gesture-handler";
import { Buffer } from "buffer";
import React, { useMemo, useEffect, useState, useCallback } from "react";
import { AppState, Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "./src/context/AppDataContext";
import { PrivateVaultProvider } from "./src/context/PrivateVaultContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AppAlertProvider } from "./src/context/AppAlertContext";
import { darkColors } from "./src/theme/colors";
import type { RootStackParamList } from "./src/navigation/types";
import ToolsDashboardScreen from "./src/screens/ToolsDashboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SyncSearchScreen from "./src/screens/SyncSearchScreen";
import SyncSettingsScreen from "./src/screens/SyncSettingsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import PrivacyPolicyScreen from "./src/screens/PrivacyPolicyScreen";
import FaqScreen from "./src/screens/FaqScreen";
import { SyncSessionProvider } from "./src/context/SyncSessionContext";
import SyncDataBridge from "./src/components/SyncDataBridge";
import SyncToolsChangeBridge from "./src/components/SyncToolsChangeBridge";
import SyncPartnerRefreshBar from "./src/components/SyncPartnerRefreshBar";
import { navigationRef } from "./src/navigation/navigationRef";
import GroceryHomeScreen from "./src/screens/GroceryHomeScreen";
import ShareExportScreen from "./src/screens/ShareExportScreen";
import ShareImportScreen from "./src/screens/ShareImportScreen";
import ToolPlaceholderScreen from "./src/screens/ToolPlaceholderScreen";
import CreateListScreen from "./src/screens/CreateListScreen";
import ListDetailScreen from "./src/screens/ListDetailScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import CompletedListPreviewScreen from "./src/screens/CompletedListPreviewScreen";
import AllDoneScreen from "./src/screens/AllDoneScreen";
import TodoHomeScreen from "./src/screens/TodoHomeScreen";
import TodoCreateListScreen from "./src/screens/TodoCreateListScreen";
import TodoListDetailScreen from "./src/screens/TodoListDetailScreen";
import TodoRecentScreen from "./src/screens/TodoRecentScreen";
import TodoRecentPreviewScreen from "./src/screens/TodoRecentPreviewScreen";
import PrivateHomeScreen from "./src/screens/PrivateHomeScreen";
import PrivateCreateListScreen from "./src/screens/PrivateCreateListScreen";
import PrivateListDetailScreen from "./src/screens/PrivateListDetailScreen";
import PrivateVaultSettingsScreen from "./src/screens/PrivateVaultSettingsScreen";
import NotesHomeScreen from "./src/screens/NotesHomeScreen";
import NoteEditorScreen from "./src/screens/NoteEditorScreen";
import ReminderHomeScreen from "./src/screens/ReminderHomeScreen";
import ReminderEditorScreen from "./src/screens/ReminderEditorScreen";
import { reconcileScheduledReminders, registerForegroundReminderFeedback } from "./src/utils/reminderNotifications";
import {
  flushPendingReminderNotificationNavigation,
  registerReminderNotificationNavigation,
} from "./src/utils/reminderNotificationNavigation";
import { reconcilePublicProfileToCloud } from "./src/services/profileCloudSync";
import { loadUserProfile } from "./src/utils/userProfileStorage";
import { normalizeUsername } from "./src/utils/usernameRules";
import { syncStatusBarForRoute } from "./src/utils/syncStatusBarForRoute";
import UsernameSetupScreen from "./src/screens/UsernameSetupScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import AppLoadingScreen from "./src/components/AppLoadingScreen";
import WebMobilePreviewFrame from "./src/components/WebMobilePreviewFrame";
import { ProSubscriptionProvider } from "./src/context/ProSubscriptionContext";

// react-native-svg (via qrcode) expects Buffer; ensure Metro resolves `buffer` and runtime has global.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Buffer = (global as any).Buffer ?? Buffer;

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Minimum branded launch time so the logo is visible on fast devices. */
const APP_LAUNCH_MIN_MS = 2000;

void SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationRoot() {
  const { colors, isDark } = useTheme();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, APP_LAUNCH_MIN_MS));
    void Promise.all([loadUserProfile(), minDelay]).then(([p]) => {
      if (cancelled) return;
      setNeedsUsername(!normalizeUsername(p.username));
      setBootstrapped(true);
      void reconcilePublicProfileToCloud(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    void SplashScreen.hideAsync().catch(() => {});
  }, [bootstrapped]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcileScheduledReminders();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const remove = registerForegroundReminderFeedback();
    return remove;
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    return registerReminderNotificationNavigation();
  }, [bootstrapped]);

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    }),
    [colors, isDark]
  );

  const applyStatusBar = useCallback(
    (routeName?: keyof RootStackParamList) => {
      syncStatusBarForRoute(routeName, isDark);
    },
    [isDark]
  );

  useEffect(() => {
    applyStatusBar(navigationRef.getCurrentRoute()?.name);
  }, [applyStatusBar]);

  if (!bootstrapped) {
    return <AppLoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        applyStatusBar(navigationRef.getCurrentRoute()?.name);
        flushPendingReminderNotificationNavigation();
      }}
      onStateChange={() => applyStatusBar(navigationRef.getCurrentRoute()?.name)}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator
        initialRouteName={needsUsername ? "UsernameSetup" : "ToolsDashboard"}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
          animationDuration: 140,
          gestureEnabled: true,
          fullScreenGestureEnabled: Platform.OS === "ios",
        }}
      >
        <Stack.Screen
          name="UsernameSetup"
          component={UsernameSetupScreen}
          options={{
            gestureEnabled: false,
            animation: "fade",
            contentStyle: { backgroundColor: darkColors.background },
          }}
        />
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{
            gestureEnabled: false,
            animation: "fade",
          }}
        />
        <Stack.Screen name="ToolsDashboard" component={ToolsDashboardScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="SyncSearch" component={SyncSearchScreen} />
        <Stack.Screen name="SyncSettings" component={SyncSettingsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Faq" component={FaqScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="GroceryHome" component={GroceryHomeScreen} />
        <Stack.Screen name="ShareExport" component={ShareExportScreen} />
        <Stack.Screen name="ShareImport" component={ShareImportScreen} />
        <Stack.Screen name="ToolPlaceholder" component={ToolPlaceholderScreen} />
        <Stack.Screen name="TodoHome" component={TodoHomeScreen} />
        <Stack.Screen
          name="TodoCreateList"
          component={TodoCreateListScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="TodoListDetail" component={TodoListDetailScreen} />
        <Stack.Screen name="TodoRecent" component={TodoRecentScreen} />
        <Stack.Screen name="TodoRecentPreview" component={TodoRecentPreviewScreen} />
        <Stack.Screen name="PrivateHome" component={PrivateHomeScreen} />
        <Stack.Screen
          name="PrivateCreateList"
          component={PrivateCreateListScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="PrivateListDetail" component={PrivateListDetailScreen} />
        <Stack.Screen name="PrivateVaultSettings" component={PrivateVaultSettingsScreen} />
        <Stack.Screen name="NotesHome" component={NotesHomeScreen} />
        <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
        <Stack.Screen name="ReminderHome" component={ReminderHomeScreen} />
        <Stack.Screen name="ReminderEditor" component={ReminderEditorScreen} />
        <Stack.Screen
          name="CreateList"
          component={CreateListScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="ListDetail" component={ListDetailScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="CompletedListPreview" component={CompletedListPreviewScreen} />
        <Stack.Screen
          name="AllDone"
          component={AllDoneScreen}
          options={
            Platform.OS === "web"
              ? { animation: "fade", gestureEnabled: false }
              : { presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }
          }
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const appShell = (
    <ThemeProvider>
      <AppAlertProvider>
        <ProSubscriptionProvider>
          <AppDataProvider>
            <PrivateVaultProvider>
              <SyncSessionProvider>
                <SyncDataBridge />
                <SyncToolsChangeBridge />
                <SyncPartnerRefreshBar />
                <NavigationRoot />
              </SyncSessionProvider>
            </PrivateVaultProvider>
          </AppDataProvider>
        </ProSubscriptionProvider>
      </AppAlertProvider>
    </ThemeProvider>
  );

  if (Platform.OS === "web") {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <WebMobilePreviewFrame>{appShell}</WebMobilePreviewFrame>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>{appShell}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
