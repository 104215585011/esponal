// Timestamp: 2026-11-18 14:01
import { useCallback, useEffect, useState } from "react";
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

import { useAuth } from "@/auth/AuthProvider";
import { AdminSettings } from "@/components/AdminSettings";
import { usePreferences } from "@/hooks/usePreferences";
import { preloadVoices, speakAuto, speakSpanish, speechStatus, stopSpeaking } from "@/lib/speech";
import { checkForUpdate, type AppVersionInfo } from "@/api/appVersion";
import { fetchAccountLanguage, updateAccountLanguage } from "@/api/account";
import { listDownloads, removeDownload } from "@/subtitles/subtitleDownload";
import {
  ACCENT_OPTIONS,
  LEARNING_LANGUAGE_OPTIONS,
  RATE_OPTIONS,
  resetPreferences,
  updatePreferences,
  type LearningLanguage
} from "@/lib/preferences";
import { colors, radius, spacing } from "@/theme";

// Timestamp: 2026-11-17 15:25
const SAMPLE_BY_LANG: Record<LearningLanguage, { speed: string; preview: string }> = {
  es: {
    speed: "Buenos días, vamos a practicar.",
    preview: "Hola, ¿qué tal? Esta es la voz que se está usando ahora."
  },
  de: {
    speed: "Guten Morgen, ich stehe um sieben Uhr auf.",
    preview: "Hallo! So klingt die deutsche Stimme beim Lernen."
  },
  en: {
    speed: "Good morning, let's practice at this speed.",
    preview: "Hello! This is the voice currently playing for English."
  },
  fr: {
    speed: "Bonjour, pratiquons à cette vitesse.",
    preview: "Bonjour ! Voici la voix utilisée pour le français."
  },
  ja: {
    speed: "おはようございます、一緒に練習しましょう。",
    preview: "こんにちは。現在使用している日本語の音声です。"
  }
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const prefs = usePreferences();

  const [checking, setChecking] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ count: number; bytes: number } | null>(null);
  /** 设备音色探测结果:用来暴露"没装西语音色时系统会拿英语音色顶上"这个静默降级 */
  const [voiceStatus, setVoiceStatus] = useState(() => speechStatus("es-ES"));
  const [detectingVoice, setDetectingVoice] = useState(false);

  const activeLangMeta =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === prefs.learningLang) ??
    LEARNING_LANGUAGE_OPTIONS[0];
  const targetVoiceLang = prefs.learningLang === "es" ? prefs.accent : activeLangMeta.ttsLang;

  const detectVoices = useCallback(async (langOverride?: string) => {
    setDetectingVoice(true);
    try {
      await preloadVoices();
    } finally {
      setVoiceStatus(speechStatus(langOverride ?? targetVoiceLang));
      setDetectingVoice(false);
    }
  }, [targetVoiceLang]);

  useEffect(() => {
    // 首帧先显示"正在检测",拿到音色表后刷新成真实结果
    void detectVoices();
    // 同步账号端活跃学习语种（本地与服务端保持一致）
    void fetchAccountLanguage()
      .then((res) => {
        if (res?.activeLanguage && res.activeLanguage !== prefs.learningLang) {
          void updatePreferences({ learningLang: res.activeLanguage });
        }
      })
      .catch(() => {
        // 离线或未登录时保留本机偏好
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectLearningLang = useCallback((lang: LearningLanguage) => {
    void updatePreferences({ learningLang: lang });
    const nextMeta = LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === lang);
    setVoiceStatus(speechStatus(lang === "es" ? prefs.accent : (nextMeta?.ttsLang ?? lang)));
    void updateAccountLanguage(lang).catch(() => {
      // 网络失败时本机 header X-Learning-Lang 仍会立即生效
    });
  }, [prefs.accent]);

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
        <Text style={styles.sectionTitle}>学习语种</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>当前词库与导入隔离</Text>
          <Text style={styles.rowHint}>
            切换后，生词本、FSRS 复习队列、导入文档和观看记录均按所选语言独立隔离，不再混入西语词库。
          </Text>
          <View style={styles.optionRow}>
            {LEARNING_LANGUAGE_OPTIONS.map((option) => {
              const active = prefs.learningLang === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelectLearningLang(option.value)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.shortLabel}
                  </Text>
                  <Text style={[styles.optionHint, active && styles.optionHintActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {user && <AdminSettings key={user.id} userId={user.id} />}

        <Text style={styles.sectionTitle}>发音与语速（{activeLangMeta.shortLabel}）</Text>
        <View style={styles.card}>
          {prefs.learningLang === "es" ? (
            <>
              <Text style={styles.rowLabel}>西语口音</Text>
              <Text style={styles.rowHint}>
                仅在学习西班牙语时区分西班牙 / 墨西哥腔调，影响查词与复习卡朗读。
              </Text>
              <View style={styles.optionRow}>
                {ACCENT_OPTIONS.map((option) => {
                  const active = prefs.accent === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        void updatePreferences({ accent: option.value });
                        speakSpanish("Hola, ¿qué tal?", { accent: option.value });
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
            </>
          ) : (
            <>
              <Text style={styles.rowLabel}>{activeLangMeta.shortLabel}发音标准</Text>
              <Text style={styles.rowHint}>
                当前学习{activeLangMeta.shortLabel}（{activeLangMeta.label}），已自动匹配对应语言标准云端女声。
              </Text>
              <View style={styles.divider} />
            </>
          )}

          <Text style={styles.rowLabel}>全局语速</Text>
          <View style={styles.rateRow}>
            {RATE_OPTIONS.map((option) => {
              const active = Math.abs(prefs.rate - option.value) < 0.01;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    void updatePreferences({ rate: option.value });
                    speakAuto(SAMPLE_BY_LANG[prefs.learningLang].speed, {
                      lang: targetVoiceLang,
                      rate: option.value
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
              onPress={() =>
                speakAuto(SAMPLE_BY_LANG[prefs.learningLang].speed, { lang: targetVoiceLang })
              }
              style={styles.tryButton}
            >
              <Text style={styles.tryText}>试听</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.voiceHead}>
            <View style={styles.voiceText}>
              <Text style={styles.rowLabel}>音色来源</Text>
              <Text style={styles.rowHint}>
                {voiceStatus.known && voiceStatus.matched
                  ? `已启用手机离线音色（${voiceStatus.matched.name}），离线也能清晰发音。`
                  : `已内置${activeLangMeta.shortLabel}云端高清音色（联网自动启用，无需另外下载手机语音包）。`}
              </Text>
            </View>
            <Pressable
              disabled={detectingVoice}
              onPress={() => void detectVoices()}
              style={styles.tryButton}
            >
              <Text style={styles.tryText}>{detectingVoice ? "刷新中" : "刷新状态"}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={() =>
              speakAuto(SAMPLE_BY_LANG[prefs.learningLang].preview, { lang: targetVoiceLang })
            }
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          >
            <View style={styles.actionText}>
              <Text style={styles.rowLabel}>试听{activeLangMeta.shortLabel}例句</Text>
              <Text style={styles.rowHint}>点一下直接用当前语种与语速试听</Text>
            </View>
            <Text style={styles.chevron}>▶</Text>
          </Pressable>
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
                    stopSpeaking();
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
                  stopSpeaking();
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
  voiceHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 8
  },
  voiceText: { flex: 1 },
  voiceList: { fontSize: 11, lineHeight: 16, color: colors.textTertiary, marginTop: 2 },
  voiceWarn: {
    marginTop: spacing.sm,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.sm,
    padding: spacing.sm
  },
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
