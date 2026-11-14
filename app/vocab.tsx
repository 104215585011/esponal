// Timestamp: 2026-11-14 15:16
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  deleteVocabWord,
  fetchVocabList,
  type VocabBucket,
  type VocabListItem,
  type VocabSort
} from "@/api/vocabList";
import { LookupSheet } from "@/components/LookupSheet";
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

/** 掌握档位:用 FSRS 复习次数粗略分档,给列表一个颜色提示 */
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

/**
 * 我的词库。
 *
 * 之前收了词只能等复习队列随机撞见,这里给出全量视图:
 * 搜词 / 按掌握度筛 / 换排序 / 点开看完整词条 / 长按删除。
 */
export default function VocabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const load = useCallback(
    async (options: { isRefresh?: boolean; append?: boolean } = {}) => {
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
          offset
        });
        setTotal(res.total);
        setItems((prev) => (options.append ? [...prev, ...res.items] : res.items));
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        if (!options.append) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [query, bucket, sort, items.length]
  );

  // 筛选/搜索变化重新拉取(首次挂载也会跑;输入框 350ms 防抖)
  useEffect(() => {
    const timer = setTimeout(
      () => {
        void load();
      },
      query ? 350 : 0
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, sort, query]);

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
                setTotal((prev) => Math.max(0, prev - 1));
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
    []
  );

  const hasMore = items.length < total;

  const header = useMemo(
    () => (
      <View>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : spacing.sm }]}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>我的词库</Text>
          <Text style={styles.headerCount}>{total}</Text>
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
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
              <Text style={styles.clearIcon}>✕</Text>
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
        </View>
      </View>
    ),
    [insets.top, router, query, bucket, sort, total]
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
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
                {error ?? (query ? "换个关键词试试" : "在视频字幕里点单词就能收进来")}
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
                  加载更多(还有 {total - items.length} 个)
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
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <LookupSheet
        onClose={() => setDetailWord(null)}
        word={detailWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },
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
  searchWrap: {
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12
  },
  searchIcon: { fontSize: 12 },
  searchInput: { flex: 1, fontSize: 13.5, color: colors.text, padding: 0 },
  clearIcon: { fontSize: 12, color: colors.textTertiary },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
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
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  sortText: { fontSize: 11.5, color: colors.textTertiary },
  sortTextOn: { color: colors.brand700, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  masteryDot: { width: 6, height: 6, borderRadius: 3 },
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
  translation: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  meta: { fontSize: 10.5, color: colors.textTertiary },
  chevron: { fontSize: 18, color: colors.textTertiary },
  center: { paddingTop: 80, alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
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
    marginHorizontal: spacing.md,
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
