// Timestamp: 2026-11-15 08:08
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

import { fetchSavedPhrases, type SavedPhrase } from "@/api/vocabList";
import { AppIcon } from "@/components/AppIcon";
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS } from "@/lib/preferences";
import { speakAuto } from "@/lib/speech";
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

/** 短语与搭配面板：可嵌入「复习」Tab，也可独立在 /phrases 页使用 */
export function PhrasesListPanel() {
  const { learningLang } = usePreferences();
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
  }, [load, learningLang]);

  const visible = filter === "all" ? items : items.filter((item) => item.kind === filter);

  return (
    <View style={styles.wrap}>
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
        <Text style={styles.countNote}>共 {visible.length} 条</Text>
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
              {error ?? "在视频字幕或查词面板点「收藏搭配」，就会出现在这里。"}
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
                    onPress={() => {
                      const opt = LEARNING_LANGUAGE_OPTIONS.find((o) => o.value === learningLang);
                      speakAuto(item.lemma, { fallbackLang: opt?.ttsLang ?? learningLang });
                    }}
                    style={styles.speakBtn}
                  >
                    <AppIcon color={colors.brand600} name="speak" size={15} />
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
                    出处：{sourceSentence}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bgSubtle },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipOn: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.brand700 },
  countNote: { marginLeft: "auto", fontSize: 11.5, color: colors.textTertiary },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  center: { paddingTop: 72, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
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
  speakBtn: { padding: 2 },
  kindBadge: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  kindText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
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
