import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "./src/context/AppDataContext";
import type { RootStackParamList } from "./src/navigation/types";
import HomeScreen from "./src/screens/HomeScreen";
import CreateListScreen from "./src/screens/CreateListScreen";
import ListDetailScreen from "./src/screens/ListDetailScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import CompletedListPreviewScreen from "./src/screens/CompletedListPreviewScreen";
import AllDoneScreen from "./src/screens/AllDoneScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f4f6f8",
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppDataProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#f4f6f8" },
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
      </AppDataProvider>
    </GestureHandlerRootView>
  );
}
