import "react-native-gesture-handler";
import { Buffer } from "buffer";
import React, { useMemo, useEffect } from "react";
import { AppState } from "react-native";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "./src/context/AppDataContext";
import { PrivateVaultProvider } from "./src/context/PrivateVaultContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import type { RootStackParamList } from "./src/navigation/types";
import ToolsDashboardScreen from "./src/screens/ToolsDashboardScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
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

// react-native-svg (via qrcode) expects Buffer; ensure Metro resolves `buffer` and runtime has global.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Buffer = (global as any).Buffer ?? Buffer;

const Stack = createNativeStackNavigator<RootStackParamList>();

function NavigationRoot() {
  const { colors, isDark } = useTheme();

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

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator
        initialRouteName="ToolsDashboard"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="ToolsDashboard" component={ToolsDashboardScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
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
          options={{ presentation: "fullScreenModal", animation: "fade" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppDataProvider>
          <PrivateVaultProvider>
            <NavigationRoot />
          </PrivateVaultProvider>
        </AppDataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
