// Timestamp: 2026-11-14 02:56
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { API_BASE } from "@/api/client";
import { checkForUpdate, currentVersion, type AppVersionInfo } from "@/api/appVersion";
import { UpdateDialog } from "@/components/UpdateDialog";
import { colors, radius, spacing } from "@/theme";

export default function MeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<{ current: string; info: AppVersionInfo } | null>(
    null
  );

  const confirmSignOut = () => {
    Alert.alert("退出登录", "下次需要重新输入密码。", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void signOut() }
    ]);
  };

  const handleCheckUpdate = async () => {
    if (checking) return;
    setChecking(true);

    try {
      const result = await checkForUpdate();
      if (result.hasUpdate) {
        setUpdate({ current: result.current, info: result.latest });
      } else {
        Alert.alert("已是最新版本", `当前 v${result.current}`);
      }
    } catch {
      Alert.alert("检查失败", "网络或服务异常,稍后再试");
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Cuenta</Text>
        <Text style={styles.title}>我的</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.email ?? "E").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userText}>
            <Text style={styles.userName}>{user?.name ?? user?.email ?? "已登录"}</Text>
            <Text style={styles.userPlan}>套餐:{user?.plan ?? "free"}</Text>
          </View>
        </View>

        <View style={styles.metaList}>
          <Pressable
            // typedRoutes 类型要等 expo start/prebuild 生成,这里先绕过(与 watch.tsx 同款做法)
            onPress={() => router.push("/vocab" as never)}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <Text style={styles.metaLabel}>我的词库</Text>
            <Text style={styles.metaAction}>查看</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/phrases" as never)}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <Text style={styles.metaLabel}>短语与搭配</Text>
            <Text style={styles.metaAction}>查看</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/downloads" as never)}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <Text style={styles.metaLabel}>我的下载</Text>
            <Text style={styles.metaAction}>查看</Text>
          </Pressable>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>版本</Text>
            <Text style={styles.metaValue}>v{currentVersion()}</Text>
          </View>

          <Pressable
            disabled={checking}
            onPress={handleCheckUpdate}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <Text style={styles.metaLabel}>检查更新</Text>
            {checking ? (
              <ActivityIndicator color={colors.brand500} size="small" />
            ) : (
              <Text style={styles.metaAction}>检查</Text>
            )}
          </Pressable>

          <View style={[styles.metaRow, styles.metaRowLast]}>
            <Text style={styles.metaLabel}>API</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {API_BASE}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        >
          <Text style={styles.signOutText}>退出登录</Text>
        </Pressable>
      </ScrollView>

      <UpdateDialog
        current={update?.current ?? ""}
        info={update?.info ?? null}
        onDismiss={() => setUpdate(null)}
        visible={Boolean(update)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  card: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: colors.brand700 },
  userText: { flex: 1, gap: 3 },
  userName: { fontSize: 15, fontWeight: "700", color: colors.text },
  userPlan: { fontSize: 12, color: colors.textSecondary },
  metaList: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  metaLabel: { fontSize: 12.5, color: colors.textSecondary },
  metaValue: { flex: 1, textAlign: "right", fontSize: 12.5, color: colors.text },
  metaRowPressed: { backgroundColor: colors.surfaceMuted },
  metaRowLast: { borderBottomWidth: 0 },
  metaAction: { fontSize: 12.5, fontWeight: "700", color: colors.brand600 },
  signOut: {
    marginTop: spacing.xl,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg
  },
  signOutPressed: { backgroundColor: colors.surfaceMuted },
  signOutText: { fontSize: 14.5, fontWeight: "600", color: colors.danger }
});
