// Timestamp: 2026-11-14 20:35
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { fetchGrammarTopics, type GrammarTopicSummary } from "@/api/grammar";
import { colors, radius, spacing } from "@/theme";

/**
 * 语法知识库(列表)。
 *
 * 内容与 Web 端 /grammar 同一份(服务端 /api/mobile/grammar 透传),
 * 不做二次编辑,避免两边文案走散。
 */
export default function GrammarListScreen() {
  const router = useRouter();

  const [groups, setGroups] = useState<string[]>([]);
  const [topics, setTopics] = useState<GrammarTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const load = useCallback(async (mode: "first" | "refresh" = "first") => {
    if (mode === "first") setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await fetchGrammarTopics();
      setGroups(res.groups);
      setTopics(res.topics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "语法内容加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (activeGroup && topic.group !== activeGroup) return false;
      if (!keyword) return true;
      return (
        topic.title.toLowerCase().includes(keyword) ||
        topic.intro.toLowerCase().includes(keyword)
      );
    });
  }, [topics, query, activeGroup]);

  // 按分组展示时插小标题:Flatten 成一条列表,省掉嵌套 FlatList
  const rows = useMemo(() => {
    if (activeGroup || query.trim()) {
      return visible.map((topic) => ({ type: "topic" as const, topic }));
    }
    const out: Array<
      { type: "group"; group: string } | { type: "topic"; topic: GrammarTopicSummary }
    > = [];
    for (const group of groups) {
      const list = visible.filter((topic) => topic.group === group);
      if (list.length === 0) continue;
      out.push({ type: "group", group });
      list.forEach((topic) => out.push({ type: "topic", topic }));
    }
    return out;
  }, [visible, groups, activeGroup, query]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>GRAMMAR</Text>
          <Text style={styles.title}>语法知识库</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="搜话题,例如 ser / 过去时 / 性别"
          placeholderTextColor={colors.textTertiary}
          style={styles.search}
          value={query}
        />
      </View>

      <FlatList
        data={topics.length > 0 ? groups : []}
        keyExtractor={(item) => `chip-${item}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
        ListHeaderComponent={
          <Pressable
            onPress={() => setActiveGroup(null)}
            style={[styles.chip, !activeGroup && styles.chipActive]}
          >
            <Text style={[styles.chipText, !activeGroup && styles.chipTextActive]}>全部</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setActiveGroup((prev) => (prev === item ? null : item))}
            style={[styles.chip, activeGroup === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, activeGroup === item && styles.chipTextActive]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listBody}
          data={rows}
          keyExtractor={(row, index) =>
            row.type === "group" ? `g-${row.group}` : `t-${row.topic.slug}-${index}`
          }
          refreshControl={
            <RefreshControl
              colors={[colors.brand500]}
              onRefresh={() => void load("refresh")}
              refreshing={refreshing}
              tintColor={colors.brand500}
            />
          }
          renderItem={({ item }) =>
            item.type === "group" ? (
              <Text style={styles.groupLabel}>{item.group}</Text>
            ) : (
              <Pressable
                onPress={() => router.push(`/grammar/${item.topic.slug}` as never)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <Text style={styles.cardTitle}>{item.topic.title}</Text>
                <Text numberOfLines={2} style={styles.cardIntro}>
                  {item.topic.intro}
                </Text>
              </Pressable>
            )
          }
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>没有匹配的话题,换个关键词试试。</Text>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: "700", color: colors.brand600, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 2 },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.text
  },
  chipScroll: { flexGrow: 0, marginTop: spacing.md },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  chipActive: { backgroundColor: colors.brand500, borderColor: colors.brand500 },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: "#fff" },
  listBody: { padding: spacing.lg, paddingBottom: 48, gap: 10 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary,
    marginTop: spacing.md,
    marginBottom: 2,
    letterSpacing: 0.6
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 6
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  cardIntro: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorText: { fontSize: 13.5, color: colors.textSecondary },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  emptyText: {
    marginTop: spacing.xl,
    textAlign: "center",
    fontSize: 13.5,
    color: colors.textTertiary
  }
});
