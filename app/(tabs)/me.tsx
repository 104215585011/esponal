// Timestamp: 2026-11-18 14:03
import { useCallback, useEffect, useState } from "react";
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
import { fetchCredits } from "@/api/account";
import { API_BASE } from "@/api/client";
import { checkForUpdate, currentVersion, type AppVersionInfo } from "@/api/appVersion";
import { AdminSettings } from "@/components/AdminSettings";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { UpdateDialog } from "@/components/UpdateDialog";
import { getPreferences, resetPreferences } from "@/lib/preferences";
import { stopSpeaking } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

const learningSettings = [
  { section: "language", label: "学习语种", icon: "book" },
  { section: "voice", label: "发音与朗读", icon: "speak" }
] satisfies { section: string; label: string; icon: AppIconName }[];

export default function MeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<{ current: string; info: AppVersionInfo } | null>(
    null
  );
  const [credits, setCredits] = useState<string | null>(null);

  const loadCredits = useCallback(async () => {
    try {
      const res = await fetchCredits();
      setCredits(res.balanceDisplay);
    } catch {
      setCredits(null);
    }
  }, []);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  const confirmSignOut = () => {
    Alert.alert("退出登录", "下次需要重新输入密码。", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => void signOut() }
    ]);
  };

  const confirmReset = () => {
    Alert.alert("恢复默认偏好", "播放速度、发音和朗读选项将恢复为默认值。", [
      { text: "取消", style: "cancel" },
      {
        text: "恢复",
        onPress: () => {
          stopSpeaking();
          const learningLang = getPreferences().learningLang;
          void resetPreferences({ learningLang });
        }
      }
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Cuenta</Text>
        <Text style={styles.title}>我的</Text>

        {/* 账号卡片 */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.email ?? "E").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userText}>
            <Text style={styles.userName}>{user?.name ?? user?.email ?? "已登录"}</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{user?.plan ?? "free"}</Text>
            </View>
          </View>
        </View>

        {/* 资产与离线内容 */}
        <Text style={styles.groupTitle}>账户与离线</Text>
        <View style={styles.metaList}>
          <Pressable
            onPress={() => router.push("/credits" as never)}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <View style={styles.rowLeft}>
              <AppIcon color={colors.amber700} name="credits" size={16} />
              <Text style={styles.metaLabel}>积分余额</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.metaAction}>{credits ?? "查看明细"}</Text>
              <AppIcon color={colors.textTertiary} name="chevron" size={14} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/downloads" as never)}
            style={({ pressed }) => [
              styles.metaRow,
              pressed && styles.metaRowPressed
            ]}
          >
            <View style={styles.rowLeft}>
              <AppIcon color={colors.brand600} name="download" size={16} />
              <Text style={styles.metaLabel}>我的下载</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.metaAction}>离线讲义</Text>
              <AppIcon color={colors.textTertiary} name="chevron" size={14} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/settings", params: { section: "storage" } } as never)}
            style={({ pressed }) => [styles.metaRow, styles.metaRowLast, pressed && styles.metaRowPressed]}
          >
            <View style={styles.rowLeft}>
              <AppIcon color={colors.textSecondary} name="settings" size={16} />
              <Text style={styles.metaLabel}>存储管理</Text>
            </View>
            <AppIcon color={colors.textTertiary} name="chevron" size={14} />
          </Pressable>
        </View>

        <Text style={styles.groupTitle}>学习设置</Text>
        <View style={styles.metaList}>
          {learningSettings.map(({ section, label, icon }, index) => (
            <Pressable
              key={section}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/settings", params: { section } } as never)}
              style={({ pressed }) => [
                styles.metaRow,
                index === learningSettings.length - 1 && styles.metaRowLast,
                pressed && styles.metaRowPressed
              ]}
            >
              <View style={styles.rowLeft}>
                <AppIcon color={colors.textSecondary} name={icon} size={16} />
                <Text style={styles.metaLabel}>{label}</Text>
              </View>
              <AppIcon color={colors.textTertiary} name="chevron" size={14} />
            </Pressable>
          ))}
        </View>

        {user && <AdminSettings key={user.id} userId={user.id} />}

        <Text style={styles.groupTitle}>应用</Text>
        <View style={styles.metaList}>
          <Pressable
            disabled={checking}
            onPress={handleCheckUpdate}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <View style={styles.rowLeft}>
              <AppIcon color={colors.brand600} name="update" size={16} />
              <Text style={styles.metaLabel}>检查更新</Text>
            </View>
            {checking ? (
              <ActivityIndicator color={colors.brand500} size="small" />
            ) : (
              <Text style={styles.metaValue}>v{currentVersion()}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={({ pressed }) => [styles.metaRow, pressed && styles.metaRowPressed]}
          >
            <Text style={styles.metaLabel}>恢复默认偏好</Text>
            <AppIcon color={colors.textTertiary} name="chevron" size={14} />
          </Pressable>

          <View style={[styles.metaRow, styles.metaRowLast]}>
            <Text style={styles.metaLabel}>API 服务</Text>
            <Text numberOfLines={1} style={styles.metaValue}>
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  card: {
    marginTop: spacing.lg,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 19, fontWeight: "800", color: colors.brand700 },
  userText: { flex: 1, gap: 4, alignItems: "flex-start" },
  userName: { fontSize: 16, fontWeight: "700", color: colors.text },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  planBadgeText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  groupTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 0.4
  },
  metaList: {
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
    paddingVertical: spacing.md + 1,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  metaValue: { flex: 1, textAlign: "right", fontSize: 12.5, color: colors.textTertiary },
  metaRowPressed: { backgroundColor: colors.surfaceMuted },
  metaRowLast: { borderBottomWidth: 0 },
  metaAction: { fontSize: 13, fontWeight: "700", color: colors.brand600 },
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
