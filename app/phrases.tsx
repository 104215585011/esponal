// Timestamp: 2026-11-14 15:20
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";

import { fetchSavedPhrases, type SavedPhrase } from "@/api/vocabList";
import { colors, radius, spacing } from "@/theme";

const KIND_LABEL: Record<string, string> = {
  collocation: "搭配",
  phrase: "短语",
  idiom: "习语"
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "全部" },
  { key: "collocation", label: "搭配" },
  { key: "phrase", label: "短语" },
  { key: "idiom", label: "习语" }
];

/** 短语/搭配收藏 —— 视频里点「整句/搭配」收藏后进来的地方 */
export default function PhrasesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SavedPhrase[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchSavedPhrases(200);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === "all" ? items : items.filter((item) => item.kind === filter);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>短语与搭配</Text>
        <Text style={styles.headerCount}>{items.length}</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.chip, filter === item.key && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === item.key && styles.chipTextOn]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.hint}>正在取收藏…</Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>{error ? "加载失败" : "还没有收藏搭配"}</Text>
            <Text style={styles.hint}>
              {error ??
                "在视频字幕里长按一组词、或在查词面板点「收藏搭配」,就会出现在这里。"}
            </Text>
            {error ? (
              <Pressable onPress={() => void load(true)} style={styles.retry}>
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          visible.map((item) => {
            const example = item.data?.examples?.[0];
            const sourceSentence = item.data?.source?.sentence ?? null;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.lemma}>{item.lemma}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => Speech.speak(item.lemma, { language: "es-ES", rate: 0.85 })}
                  >
                    <Text style={styles.speak}>🔊</Text>
                  </Pressable>
                  <View style={styles.kindBadge}>
                    <Text style={styles.kindText}>
                      {KIND_LABEL[item.kind] ?? item.kind}
                    </Text>
                  </View>
                </View>

                {item.translationZh ? (
                  <Text style={styles.translation}>{item.translationZh}</Text>
                ) : null}

                {item.explanationZh ? (
                  <Text style={styles.explanation}>{item.explanationZh}</Text>
                ) : null}

                {example?.es ? (
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleEs}>{example.es}</Text>
                    {example.zh ? <Text style={styles.exampleZh}>{example.zh}</Text> : null}
                  </View>
                ) : null}

                {sourceSentence ? (
                  <Text numberOfLines={2} style={styles.source}>
                    出处:{sourceSentence}
                  </Text>
                ) : null}
              </View>
            );
          })
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
  headerCount: { fontSize: 12.5, fontWeight: "700", color: colors.textTertiary },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg
  },
  chipOn: { backgroundColor: colors.brand50 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.brand700 },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { paddingTop: 80, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12.5, lineHeight: 19, color: colors.textTertiary, textAlign: "center" },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 6
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  lemma: { fontSize: 15.5, fontWeight: "700", color: colors.text, flexShrink: 1 },
  speak: { fontSize: 14 },
  kindBadge: {
    marginLeft: "auto",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  kindText: { fontSize: 10, fontWeight: "600", color: colors.textSecondary },
  translation: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  explanation: { fontSize: 12, lineHeight: 19, color: colors.textSecondary },
  exampleBox: {
    marginTop: 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand100,
    paddingLeft: 8,
    gap: 2
  },
  exampleEs: { fontSize: 12.5, lineHeight: 19, color: colors.text },
  exampleZh: { fontSize: 11.5, lineHeight: 18, color: colors.textTertiary },
  source: { fontSize: 11, lineHeight: 17, color: colors.textTertiary }
});
