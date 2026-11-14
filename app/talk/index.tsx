// Timestamp: 2026-11-14 15:40
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { fetchTalkCharacters, fetchTalkSessions, type TalkCharacter, type TalkSessionItem } from "@/api/talk";
import { colors, radius, spacing } from "@/theme";

/** 只有 Carlos 是西语角色,其余作为「其它语言」展示,避免误点 */
const SPANISH_CHARACTER = "carlos";

const LANG_HINT: Record<string, string> = {
  emma: "英语 · 英式",
  jake: "英语 · 美式",
  sophie: "法语",
  kenji: "日语",
  carlos: "西班牙语"
};

export default function TalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [characters, setCharacters] = useState<TalkCharacter[]>([]);
  const [sessions, setSessions] = useState<TalkSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchTalkCharacters();
      // Carlos(西语)置顶
      const sorted = [...list].sort((a, b) =>
        a.id === SPANISH_CHARACTER ? -1 : b.id === SPANISH_CHARACTER ? 1 : 0
      );
      setCharacters(sorted);

      try {
        setSessions(await fetchTalkSessions(SPANISH_CHARACTER));
      } catch {
        setSessions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const spanish = characters.find((item) => item.id === SPANISH_CHARACTER);
  const others = characters.filter((item) => item.id !== SPANISH_CHARACTER);
  const lastSession = sessions[0];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>口语练习</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          和 AI 角色用西语聊天。说错了它会顺手指出来,聊完还能看到这轮出现的新词。
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.hint}>正在取角色…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>加载失败</Text>
            <Text style={styles.hint}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {spanish ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/talk/[characterId]",
                    params: { characterId: spanish.id }
                  } as never)
                }
                style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
              >
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>
                    {spanish.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.heroText}>
                  <View style={styles.heroTitleRow}>
                    <Text style={styles.heroName}>{spanish.name}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>西班牙语</Text>
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.heroBio}>
                    {spanish.bio}
                  </Text>
                  <Text style={styles.heroStyle} numberOfLines={2}>
                    {spanish.style}
                  </Text>
                </View>
                <Text style={styles.heroArrow}>→</Text>
              </Pressable>
            ) : null}

            {lastSession ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/talk/[characterId]",
                    params: { characterId: SPANISH_CHARACTER, sessionId: lastSession.id }
                  } as never)
                }
                style={({ pressed }) => [styles.resumeCard, pressed && styles.pressed]}
              >
                <View style={styles.resumeText}>
                  <Text style={styles.resumeLabel}>继续上次</Text>
                  <Text numberOfLines={1} style={styles.resumePreview}>
                    {lastSession.lastMessagePreview || lastSession.title}
                  </Text>
                </View>
                <Text style={styles.resumeAction}>接着聊 ›</Text>
              </Pressable>
            ) : null}

            {others.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>其它语言(本站以西语为主)</Text>
                {others.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      router.push({
                        pathname: "/talk/[characterId]",
                        params: { characterId: item.id }
                      } as never)
                    }
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowLang}>{LANG_HINT[item.id] ?? item.language}</Text>
                    </View>
                    <Text style={styles.rowArrow}>›</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            <Text style={styles.footnote}>
              每轮对话会消耗积分(服务端按次计费),回复由大模型生成,建议当作陪练而不是标准答案。
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  backHit: { width: 26, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  intro: { fontSize: 12.5, lineHeight: 20, color: colors.textSecondary },
  center: { paddingTop: 60, alignItems: "center", gap: spacing.sm },
  hint: { fontSize: 12.5, color: colors.textTertiary, textAlign: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.8 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brand600,
    borderRadius: radius.xl,
    padding: spacing.lg
  },
  avatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarLargeText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  heroText: { flex: 1, gap: 3 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroName: { fontSize: 15.5, fontWeight: "800", color: "#fff" },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  heroBio: { fontSize: 11.5, lineHeight: 17, color: "rgba(255,255,255,0.88)" },
  heroStyle: { fontSize: 10.5, lineHeight: 16, color: "rgba(255,255,255,0.7)" },
  heroArrow: { fontSize: 16, fontWeight: "700", color: "#fff" },
  resumeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  resumeText: { flex: 1, gap: 3 },
  resumeLabel: { fontSize: 10.5, fontWeight: "700", color: colors.brand700 },
  resumePreview: { fontSize: 12.5, color: colors.textSecondary },
  resumeAction: { fontSize: 12, fontWeight: "700", color: colors.brand600 },
  sectionTitle: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowLang: { fontSize: 11, color: colors.textTertiary },
  rowArrow: { fontSize: 18, color: colors.textTertiary },
  footnote: {
    marginTop: spacing.md,
    fontSize: 10.5,
    lineHeight: 17,
    color: colors.textTertiary
  }
});
