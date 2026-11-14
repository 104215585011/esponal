// Timestamp: 2026-11-14 20:44
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Speech from "expo-speech";

import { useAuth } from "@/auth/AuthProvider";
import { usePreferences } from "@/hooks/usePreferences";
import { speakSpanish } from "@/lib/speech";
import { checkForUpdate, type AppVersionInfo } from "@/api/appVersion";
import { listDownloads, removeDownload } from "@/subtitles/subtitleDownload";
import {
  ACCENT_OPTIONS,
  RATE_OPTIONS,
  resetPreferences,
  updatePreferences
} from "@/lib/preferences";
import { colors, radius, spacing } from "@/theme";

/**
 * 设置。
 *
 * 只放"设备本地"的偏好 —— 发音口音/语速、自动朗读、缓存清理、关于。
 * 账号相关的(邮箱、改密码、退出)留在「我的」页,两处不重复。
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const prefs = usePreferences();

  const [checking, setChecking] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ count: number; bytes: number } | null>(null);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  // 缓存体积按需算,不在首屏跑(要遍历下载目录)
  const measureCache = useCallback(async () => {
    try {
      const items = await listDownloads();
      const bytes = items.reduce((sum, item) => sum + (item.size ?? 0), 0);
      setCacheInfo({ count: items.length, bytes });
    } catch {
      setCacheInfo({ count: 0, bytes: 0 });
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setChecking(true);
    try {
      const result: { hasUpdate: boolean; current: string; latest: AppVersionInfo } =
        await checkForUpdate();
      if (result.hasUpdate) {
        Alert.alert(
          "有新版本",
          `当前 ${result.current},最新 ${result.latest.latestVersion}。\n\n去「我的 → 检查更新」可以直接下载安装。`
        );
      } else {
        Alert.alert("已是最新", `当前版本 ${result.current}。`);
      }
    } catch {
      Alert.alert("检查失败", "网络不通或服务暂时不可用,稍后再试。");
    } finally {
      setChecking(false);
    }
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert("清除下载的讲义", "会删掉本机保存的字幕讲义 PDF,不影响词库和进度。", [
      { text: "取消", style: "cancel" },
      {
        text: "清除",
        style: "destructive",
        onPress: async () => {
          try {
            const items = await listDownloads();
            for (const item of items) {
              await removeDownload(item);
            }
            setCacheInfo({ count: 0, bytes: 0 });
            Alert.alert("已清除");
          } catch {
            Alert.alert("清除失败", "有文件被占用,稍后再试。");
          }
        }
      }
    ]);
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>设置</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>发音</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>口音</Text>
          <Text style={styles.rowHint}>
            影响所有朗读(查词、复习卡、短语、语法例句)。角色对话里的西语角色也跟着变。
          </Text>
          <View style={styles.optionRow}>
            {ACCENT_OPTIONS.map((option) => {
              const active = prefs.accent === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    void updatePreferences({ accent: option.value });
                    speakSpanish("Hola, ¿qué tal?", { accent: option.value, interrupt: false });
                  }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionHint, active && styles.optionHintActive]}>
                    {option.hint.trim()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.rowLabel}>语速</Text>
          <View style={styles.rateRow}>
            {RATE_OPTIONS.map((option) => {
              const active = Math.abs(prefs.rate - option.value) < 0.01;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    void updatePreferences({ rate: option.value });
                    speakSpanish("Buenos días, vamos a practicar.", {
                      rate: option.value,
                      interrupt: false
                    });
                  }}
                  style={[styles.rateChip, active && styles.rateChipActive]}
                >
                  <Text style={[styles.rateText, active && styles.rateTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              hitSlop={8}
              onPress={() => speakSpanish("Esta es la velocidad actual.")}
              style={styles.tryButton}
            >
              <Text style={styles.tryText}>试听</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>朗读行为</Text>
        <View style={styles.card}>
          <RowSwitch
            hint="阅读页一段读完自动播下一段"
            label="连续朗读"
            onChange={(value) => void updatePreferences({ autoNextParagraph: value })}
            value={prefs.autoNextParagraph}
          />
          <View style={styles.divider} />
          <RowSwitch
            hint="换到新卡片时自动念一遍单词"
            label="复习时自动发音"
            onChange={(value) => void updatePreferences({ autoSpeakReview: value })}
            value={prefs.autoSpeakReview}
          />
        </View>

        <Text style={styles.sectionTitle}>存储</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => void measureCache()}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <View style={styles.actionText}>
              <Text style={styles.rowLabel}>已下载的讲义</Text>
              <Text style={styles.rowHint}>
                {cacheInfo
                  ? `${cacheInfo.count} 份 · ${formatBytes(cacheInfo.bytes)}`
                  : "点一下统计占用空间"}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={[styles.rowLabel, styles.danger]}>清除下载的讲义</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>关于</Text>
        <View style={styles.card}>
          <View style={styles.actionRow}>
            <Text style={styles.rowLabel}>版本</Text>
            <Text style={styles.value}>v{version}</Text>
          </View>
          <View style={styles.divider} />
          <Pressable
            disabled={checking}
            onPress={() => void handleCheckUpdate()}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={styles.rowLabel}>{checking ? "检查中…" : "检查更新"}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            onPress={() => {
              Alert.alert("恢复默认设置", "口音、语速、朗读行为都会回到初始值。", [
                { text: "取消", style: "cancel" },
                {
                  text: "恢复",
                  onPress: () => {
                    Speech.stop();
                    void resetPreferences();
                  }
                }
              ]);
            }}
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <Text style={styles.rowLabel}>恢复默认设置</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            Alert.alert("退出登录", "退出后需要重新登录才能同步进度。", [
              { text: "取消", style: "cancel" },
              {
                text: "退出",
                style: "destructive",
                onPress: () => {
                  Speech.stop();
                  void signOut();
                }
              }
            ]);
          }}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        >
          <Text style={styles.signOutText}>退出登录</Text>
        </Pressable>

        <Text style={styles.footnote}>
          偏好保存在本机,不与账号同步;换手机需要重新设置一次。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowSwitch({
  label,
  hint,
  value,
  onChange
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.actionText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        onValueChange={onChange}
        thumbColor="#fff"
        trackColor={{ false: colors.border, true: colors.brand500 }}
        value={value}
      />
    </View>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  body: { padding: spacing.lg, paddingBottom: 64, gap: spacing.sm },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 0.8
  },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rowLabel: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  rowHint: { fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: 3 },
  optionRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  option: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 2
  },
  optionActive: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  optionText: { fontSize: 13, fontWeight: "700", color: colors.text },
  optionTextActive: { color: colors.brand700 },
  optionHint: { fontSize: 10, color: colors.textTertiary, textAlign: "center" },
  optionHintActive: { color: colors.brand600 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm
  },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  rateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  rateChipActive: { backgroundColor: colors.brand500, borderColor: colors.brand500 },
  rateText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  rateTextActive: { color: "#fff" },
  tryButton: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 8 },
  tryText: { fontSize: 13, fontWeight: "700", color: colors.brand600 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 6
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 10
  },
  actionRowPressed: { opacity: 0.6 },
  actionText: { flex: 1 },
  value: { fontSize: 13.5, color: colors.textTertiary },
  chevron: { fontSize: 18, color: colors.textTertiary },
  danger: { color: colors.danger },
  signOut: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  signOutPressed: { backgroundColor: colors.dangerBg },
  signOutText: { fontSize: 15, fontWeight: "700", color: colors.danger },
  footnote: {
    marginTop: spacing.md,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textTertiary,
    textAlign: "center"
  }
});
