import { Stack } from "expo-router";
import { ML10XProvider } from "@/context/ML10XContext";

export default function RootLayout() {
  return (
    <ML10XProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="logs"
          options={{
            presentation: "modal",
            headerShown: true,
            headerTitle: "Debug logs",
            headerStyle: { backgroundColor: "#111" },
            headerTintColor: "#fff",
          }}
        />
      </Stack>
    </ML10XProvider>
  );
}
