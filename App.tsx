import "react-native-gesture-handler";
import React, { useMemo } from "react";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "./src/context/AppDataContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import type { RootStackParamList } from "./src/navigation/types";
import HomeScreen from "./src/screens/HomeScreen";
import CreateListScreen from "./src/screens/CreateListScreen";
import ListDetailScreen from "./src/screens/ListDetailScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import CompletedListPreviewScreen from "./src/screens/CompletedListPreviewScreen";
import AllDoneScreen from "./src/screens/AllDoneScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

function NavigationRoot() {
  const { colors, isDark } = useTheme();

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
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
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
          <NavigationRoot />
        </AppDataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
