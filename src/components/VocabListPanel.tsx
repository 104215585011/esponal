// Timestamp: 2026-11-17 15:45
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import {
  deleteVocabWord,
  fetchVocabList,
  type VocabBucket,
  type VocabListItem,
  type VocabSort
} from "@/api/vocabList";
import { AppIcon } from "@/components/AppIcon";
import { LookupSheet } from "@/components/LookupSheet";
import { usePreferences } from "@/hooks/usePreferences";
import { colors, radius, spacing } from "@/theme";

const BUCKETS: Array<{ key: VocabBucket; label: string }> = [
  { key: "all", label: "全部" },
  { key: "new", label: "新词" },
  { key: "learning", label: "学习中" },
  { key: "mastered", label: "熟练" }
];

const SORTS: Array<{ key: VocabSort; label: string }> = [
  { key: "recent", label: "最近添加" },
  { key: "due", label: "快到复习" },
  { key: "alpha", label: "字母序" }
];

function masteryOf(reps: number) {
  if (reps >= 3) return { color: colors.brand600, label: "熟练" };
  if (reps >= 1) return { color: "#F59E0B", label: "学习中" };
  return { color: colors.textTertiary, label: "新词" };
}

function dueLabel(iso: string | null) {
  if (!iso) return "待首次复习";
  const due = new Date(iso).getTime();
  const diffDays = Math.round((due - Date.now()) / 86_400_000);
  if (diffDays <= 0) return "今天该复习";
  if (diffDays === 1) return "明天复习";
  return `${diffDays} 天后复习`;
}

/** 我的词库面板：可嵌入「复习」Tab，也可独立在 /vocab 页使用 */
export function VocabListPanel({
  onTotalChange
}: {
  onTotalChange?: (total: number) => void;
}) {
  const { learningLang } = usePreferences();
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<VocabBucket>("all");
  const [sort, setSort] = useState<VocabSort>("recent");
  const [items, setItems] = useState<VocabListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailWord, setDetailWord] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const reqSeqRef = useRef(0);
  const latestLangRef = useRef(learningLang);
  latestLangRef.current = learningLang;

  const load = useCallback(
    async (options: { isRefresh?: boolean; append?: boolean } = {}) => {
      const seq = ++reqSeqRef.current;
      const reqLang = learningLang;
      if (options.isRefresh) setRefreshing(true);
      else if (options.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const offset = options.append ? items.length : 0;
        const res = await fetchVocabList({
          q: query,
          bucket,
          sort,
          limit: 60,
          offset,
          lang: reqLang
        });
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setTotal(res.total);
        onTotalChange?.(res.total);
        setItems((prev) => (options.append ? [...prev, ...res.items] : res.items));
      } catch (e) {
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
        if (!options.append) setItems([]);
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [query, bucket, sort, items.length, learningLang, onTotalChange]
  );

  useEffect(() => {
    const timer = setTimeout(
      () => {
        void load();
      },
      query ? 350 : 0
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, sort, query, learningLang]);

  const confirmDelete = useCallback(
    (word: VocabListItem) => {
      Alert.alert("从词库删除", `删除「${word.lemma}」?它出现的例句记录也会一起清掉。`, [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(word.id);
              try {
                await deleteVocabWord(word.id);
                setItems((prev) => prev.filter((item) => item.id !== word.id));
                setTotal((prev) => {
                  const next = Math.max(0, prev - 1);
                  onTotalChange?.(next);
                  return next;
                });
              } catch (e) {
                Alert.alert("删除失败", e instanceof Error ? e.message : "稍后再试");
              } finally {
                setDeleting(null);
              }
            })();
          }
        }
      ]);
    },
    [onTotalChange]
  );

  const hasMore = items.length < total;

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.searchWrap}>
          <AppIcon color={colors.textTertiary} name="search" size={15} />
          <TextInput
            onChangeText={setQuery}
            placeholder="搜单词或释义"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable hitSlop={8} onPress={() => setQuery("")}>
              <AppIcon color={colors.textTertiary} name="close" size={14} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {BUCKETS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setBucket(item.key)}
              style={[styles.chip, bucket === item.key && styles.chipOn]}
            >
              <Text style={[styles.chipText, bucket === item.key && styles.chipTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sortRow}>
          {SORTS.map((item) => (
            <Pressable key={item.key} onPress={() => setSort(item.key)}>
              <Text style={[styles.sortText, sort === item.key && styles.sortTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.countNote}>共 {total} 词</Text>
        </View>
      </View>
    ),
    [query, bucket, sort, total]
  );

  return (
    <View style={styles.wrap}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() =>
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand500} />
              <Text style={styles.hint}>正在取词库…</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>
                {error ? "加载失败" : query ? "没有匹配的词" : "词库还是空的"}
              </Text>
              <Text style={styles.hint}>
                {error ?? (query ? "换个关键词试试" : "在视频字幕或阅读文章里点单词就能收进来")}
              </Text>
              <Pressable onPress={() => void load({ isRefresh: true })} style={styles.retry}>
                <Text style={styles.retryText}>{error ? "重试" : "刷新"}</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={() =>
          hasMore ? (
            <Pressable
              disabled={loadingMore}
              onPress={() => void load({ append: true })}
              style={styles.moreButton}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.brand500} size="small" />
              ) : (
                <Text style={styles.moreText}>
                  加载更多（还有 {total - items.length} 个）
                </Text>
              )}
            </Pressable>
          ) : items.length > 0 ? (
            <Text style={styles.endText}>— 共 {total} 个 —</Text>
          ) : null
        }
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load({ isRefresh: true })}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        renderItem={({ item }) => {
          const mastery = masteryOf(item.srsReps);
          return (
            <Pressable
              delayLongPress={350}
              onLongPress={() => confirmDelete(item)}
              onPress={() => setDetailWord(item.lemma)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.masteryDot, { backgroundColor: mastery.color }]} />
              <View style={styles.rowText}>
                <View style={styles.rowHead}>
                  <Text style={styles.lemma}>{item.lemma}</Text>
                  {item.partOfSpeech ? (
                    <Text style={styles.pos}>{item.partOfSpeech}</Text>
                  ) : null}
                  {deleting === item.id ? (
                    <ActivityIndicator color={colors.textTertiary} size="small" />
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.translation}>
                  {item.meanings[0] ?? item.translation}
                </Text>
                <Text style={styles.meta}>
                  {item.encounterCount > 0 ? `见过 ${item.encounterCount} 次 · ` : ""}
                  {dueLabel(item.srsDue)}
                </Text>
              </View>
              <AppIcon color={colors.textTertiary} name="chevron" size={14} />
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <LookupSheet onClose={() => setDetailWord(null)} word={detailWord} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },
  headerBlock: { paddingTop: spacing.sm },
  searchWrap: {
    marginHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14
  },
  searchInput: { flex: 1, fontSize: 13.5, color: colors.text, padding: 0 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  chipOn: { backgroundColor: colors.brand50 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: colors.brand700 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  sortText: { fontSize: 12, color: colors.textTertiary },
  sortTextOn: { color: colors.brand700, fontWeight: "700" },
  countNote: { marginLeft: "auto", fontSize: 11.5, color: colors.textTertiary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  masteryDot: { width: 7, height: 7, borderRadius: 4 },
  rowText: { flex: 1, gap: 3 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  lemma: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  pos: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  translation: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  meta: { fontSize: 11, color: colors.textTertiary },
  center: { paddingTop: 72, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12.5, color: colors.textTertiary, textAlign: "center" },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  moreButton: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  moreText: { fontSize: 12.5, fontWeight: "600", color: colors.brand600 },
  endText: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: 11.5,
    color: colors.textTertiary
  }
});
