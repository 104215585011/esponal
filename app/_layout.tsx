// Timestamp: 2026-11-13 17:28
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  anchor: "(tabs)"
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    const inSignIn = segments[0] === "sign-in";

    if (status === "signedOut" && !inSignIn) {
      router.replace("/sign-in");
      return;
    }

    if (status === "signedIn" && inSignIn) {
      router.replace("/");
    }
  }, [status, segments, router]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brand500} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg
  }
});
