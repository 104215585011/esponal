// Timestamp: 2026-11-14 02:52
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { checkForUpdate, type AppVersionInfo } from "@/api/appVersion";
import { UpdateDialog } from "@/components/UpdateDialog";
import { loadPreferences } from "@/lib/preferences";
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

  const [update, setUpdate] = useState<{ current: string; info: AppVersionInfo } | null>(
    null
  );

  // 登录后静默检查一次更新(失败静默,不打扰用户)
  useEffect(() => {
    // 设备偏好(口音/语速/自动朗读)启动时读一次,先到内存,后面各页同步读
    void loadPreferences();

    if (status !== "signedIn") return;

    let cancelled = false;

    checkForUpdate()
      .then((result) => {
        if (!cancelled && result.hasUpdate) {
          setUpdate({ current: result.current, info: result.latest });
        }
      })
      .catch(() => {
        // 检查更新失败不弹任何东西
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

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
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
      </Stack>

      <UpdateDialog
        current={update?.current ?? ""}
        info={update?.info ?? null}
        onDismiss={() => setUpdate(null)}
        visible={Boolean(update)}
      />
    </>
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
