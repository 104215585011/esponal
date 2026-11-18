// Timestamp: 2026-11-18 11:25
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  fetchLecturaFeed,
  type LecturaContentKind,
  type LecturaContinueItem,
  type LecturaLevel,
  type LecturaListItem,
  type LecturaSourceSummary
} from "@/api/lectura";
import { getProxiedCoverUrl } from "@/api/podcasts";
import { ImportShelfPanel } from "@/components/ImportShelfPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS, type LearningLanguage } from "@/lib/preferences";
import { colors, radius, spacing } from "@/theme";

type ReadTab = "stories" | "sources" | "shelf";
type LevelFilter = "ALL" | LecturaLevel | "UNCONFIRMED";
type DurationFilter = "ALL" | "short" | "medium" | "long";

const KIND_LABEL: Record<LecturaContentKind, string> = {
  story: "分级短文",
  blog: "生活博客",
  news: "外刊新闻"
};

/**
 * 阅读 Tab（V1 升级版）：
 * - 顶部：继续阅读（直达上次停下的段落）
 * - 主区：跨来源混排推荐 + 难度 / 题材 / 阅读时长筛选
 * - 独立入口：来源列表 + 我的书架
 */
export default function LecturaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { learningLang } = usePreferences();
  const langLabel =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === learningLang)?.shortLabel ?? "目标语";
  const reqSeqRef = useRef(0);
  const latestLangRef = useRef(learningLang);
  latestLangRef.current = learningLang;

  const [subTab, setSubTab] = useState<ReadTab>(
    params.tab === "shelf" ? "shelf" : params.tab === "sources" ? "sources" : "stories"
  );

  useEffect(() => {
    if (params.tab === "shelf") setSubTab("shelf");
    else if (params.tab === "sources") setSubTab("sources");
    else if (params.tab === "stories") setSubTab("stories");
  }, [params.tab]);

  const [items, setItems] = useState<LecturaListItem[]>([]);
  const [continueReading, setContinueReading] = useState<LecturaContinueItem | null>(null);
  const [sources, setSources] = useState<LecturaSourceSummary[]>([]);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      const seq = ++reqSeqRef.current;
      const reqLang = learningLang;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setItems([]);
        setContinueReading(null);
        setSources([]);
        setLevelFilter("ALL");
        setTopicFilter("ALL");
        setDurationFilter("ALL");
        setSourceFilter(null);
      }
      setError(null);

      try {
        const feed = await fetchLecturaFeed(isRefresh, reqLang);
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setItems(feed.items);
        setContinueReading(feed.continueReading);
        setSources(feed.sources);
      } catch (e) {
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [learningLang]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const t = item.topic?.trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return ["ALL", ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k)];
  }, [items]);

  const activeSourceLabel = useMemo(() => {
    if (!sourceFilter) return null;
    return sources.find((s) => s.sourceId === sourceFilter)?.sourceLabel ?? sourceFilter;
  }, [sourceFilter, sources]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (sourceFilter && item.sourceId !== sourceFilter) return false;
      if (levelFilter === "UNCONFIRMED" && item.level !== null) return false;
      if (
        levelFilter !== "ALL" &&
        levelFilter !== "UNCONFIRMED" &&
        item.level !== levelFilter
      ) {
        return false;
      }
      if (topicFilter !== "ALL" && item.topic !== topicFilter) return false;
      if (durationFilter === "short" && item.durationMin > 3) return false;
      if (durationFilter === "medium" && (item.durationMin < 4 || item.durationMin > 6)) {
        return false;
      }
      if (durationFilter === "long" && item.durationMin < 7) return false;
      return true;
    });
  }, [items, sourceFilter, levelFilter, topicFilter, durationFilter]);

  const hasUnconfirmed = useMemo(() => items.some((i) => i.level === null), [items]);

  const levelChips: Array<{ key: LevelFilter; label: string }> = [
    { key: "ALL", label: "全部难度" },
    { key: "A1", label: "A1" },
    { key: "A2", label: "A2" },
    { key: "B1", label: "B1" },
    ...(hasUnconfirmed ? [{ key: "UNCONFIRMED" as const, label: "难度待确认" }] : [])
  ];

  const durationChips: Array<{ key: DurationFilter; label: string }> = [
    { key: "ALL", label: "全部时长" },
    { key: "short", label: "3分钟内" },
    { key: "medium", label: "4–6分钟" },
    { key: "long", label: "7分钟+" }
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topHeader}>
        <Text style={styles.eyebrow}>Lectura · {langLabel}</Text>
        <Text style={styles.title}>{learningLang === "es" ? "阅读" : `${langLabel}阅读`}</Text>
        <View style={styles.segWrap}>
          <SegmentedControl
            onChange={(next) => setSubTab(next as ReadTab)}
            options={[
              { key: "stories", label: "精选推荐" },
              { key: "sources", label: `来源 (${sources.length})` },
              { key: "shelf", label: "我的书架" }
            ]}
            value={subTab}
          />
        </View>
      </View>

      {subTab === "shelf" ? (
        <ImportShelfPanel />
      ) : subTab === "sources" ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={sources}
          keyExtractor={(item) => item.sourceId}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand500} />
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>当前语种暂无已收录来源</Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View style={styles.storiesHeader}>
              <Text style={styles.subtitle}>
                按内容来源浏览已核验正文的文章，点选来源后只看该栏目内容。
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setSourceFilter(item.sourceId);
                setSubTab("stories");
              }}
              style={({ pressed }) => [styles.sourceCard, pressed && styles.cardPressed]}
            >
              <View style={styles.sourceCardMain}>
                <Text style={styles.kindTag}>{KIND_LABEL[item.contentKind]}</Text>
                <Text style={styles.sourceName}>{item.sourceLabel}</Text>
              </View>
              <Text style={styles.sourceCount}>{item.count} 篇 ›</Text>
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={(item) => item.slug}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand500} />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void load(false)} style={styles.retry}>
                  <Text style={styles.retryText}>重试</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>当前筛选暂无匹配文章，试试放宽条件</Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View style={styles.storiesHeader}>
              {/* 顶部：继续阅读 */}
              {continueReading ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/lectura/[slug]",
                      params: {
                        slug: continueReading.slug,
                        lang: continueReading.language,
                        p: String(continueReading.lastParagraphIndex)
                      }
                    } as never)
                  }
                  style={({ pressed }) => [styles.continueCard, pressed && styles.cardPressed]}
                >
                  <View style={styles.continueHead}>
                    <Text style={styles.continueEyebrow}>继续阅读 · 回到上次段落</Text>
                    <Text style={styles.continueProgress}>
                      第 {continueReading.lastParagraphIndex + 1} /{" "}
                      {Math.max(1, continueReading.totalParagraphs)} 段
                    </Text>
                  </View>
                  <Text style={styles.continueTitle}>{continueReading.titleZh}</Text>
                  <Text numberOfLines={1} style={styles.continueSub}>
                    {continueReading.summaryZh}
                  </Text>
                  <Text style={styles.continueMeta}>
                    {continueReading.level ?? "难度待确认"} · {continueReading.topic} · 约{" "}
                    {continueReading.durationMin} 分钟 · {continueReading.sourceLabel}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.subtitle}>
                  跨来源精选{langLabel}分级短文、生活博客与外刊，每篇附中文看点、原声区分与点词收藏。
                </Text>
              )}

              {activeSourceLabel ? (
                <View style={styles.activeSourceRow}>
                  <Text style={styles.activeSourceText}>当前来源：{activeSourceLabel}</Text>
                  <Pressable onPress={() => setSourceFilter(null)}>
                    <Text style={styles.clearSourceText}>清除筛选 ×</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* 筛选行 1：难度 + 时长 */}
              <ScrollView
                contentContainerStyle={styles.chips}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {levelChips.map((item) => {
                  const on = levelFilter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setLevelFilter(item.key)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={styles.chipDivider} />
                {durationChips.map((item) => {
                  const on = durationFilter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setDurationFilter(item.key)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 筛选行 2：题材 */}
              {topicOptions.length > 2 ? (
                <ScrollView
                  contentContainerStyle={styles.chipsSecondary}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {topicOptions.map((t) => {
                    const on = topicFilter === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setTopicFilter(t)}
                        style={[styles.topicChip, on && styles.topicChipOn]}
                      >
                        <Text style={[styles.topicChipText, on && styles.topicChipTextOn]}>
                          {t === "ALL" ? "全部题材" : t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={[colors.brand500]}
              onRefresh={() => void load(true)}
              refreshing={refreshing}
              tintColor={colors.brand500}
            />
          }
          renderItem={({ item }) => {
            const cover = item.coverUrl ? getProxiedCoverUrl(item.coverUrl) ?? item.coverUrl : null;
            const kindLabel = item.contentKind ? KIND_LABEL[item.contentKind] : item.source;
            const resumePara = item.lastParagraphIndex ?? 0;
            const isDone = Boolean(item.completed ?? item.isRead);
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/lectura/[slug]",
                    params: {
                      slug: item.slug,
                      lang: item.language ?? learningLang,
                      ...(resumePara > 0 && !isDone ? { p: String(resumePara) } : {})
                    }
                  } as never)
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardMain}>
                    <View style={styles.badges}>
                      <Text
                        style={
                          item.level ? styles.levelBadge : styles.levelUnconfirmedBadge
                        }
                      >
                        {item.level ?? "难度待确认"}
                      </Text>
                      <Text style={styles.kindTag}>{kindLabel}</Text>
                      {item.isFullText === false ? (
                        <Text style={styles.excerptBadge}>节选</Text>
                      ) : null}
                      {item.audioType === "native" ? (
                        <Text style={styles.nativeAudioBadge}>🎧 原声</Text>
                      ) : null}
                      {isDone ? (
                        <Text style={styles.readBadge}>✓ 已读完</Text>
                      ) : resumePara > 0 ? (
                        <Text style={styles.resumeBadge}>续读 §{resumePara + 1}</Text>
                      ) : null}
                    </View>

                    {/* 中文标题 + 一句具体看点 */}
                    <Text style={styles.cardTitleZh}>{item.titleZh}</Text>
                    <Text numberOfLines={2} style={styles.cardSummary}>
                      {item.summaryZh}
                    </Text>

                    <Text style={styles.metaText}>
                      约 {item.durationMin} 分钟
                      {item.topic ? ` · ${item.topic}` : ""} · {item.source} ·{" "}
                      {item.isFullText === false ? "节选" : "全文"} ·{" "}
                      {item.audioType === "native" ? "原声" : "合成朗读"}
                    </Text>

                    {item.title && item.title !== item.titleZh ? (
                      <Text numberOfLines={1} style={styles.cardTitleOriginal}>
                        {item.title}
                      </Text>
                    ) : null}
                  </View>

                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.cardCover} resizeMode="cover" />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  topHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgSubtle
  },
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
  segWrap: {
    marginTop: spacing.md
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  storiesHeader: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary
  },
  continueCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
    padding: spacing.lg,
    gap: 6
  },
  continueHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  continueEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand700
  },
  continueProgress: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand600
  },
  continueTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  continueSub: {
    fontSize: 12.5,
    color: colors.textSecondary
  },
  continueMeta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textTertiary
  },
  activeSourceRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.brand100
  },
  activeSourceText: { fontSize: 12, fontWeight: "600", color: colors.brand700 },
  clearSourceText: { fontSize: 12, fontWeight: "700", color: colors.brand600 },
  chips: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  chipDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipOn: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: "#fff" },
  chipsSecondary: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs
  },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  topicChipOn: {
    backgroundColor: colors.text
  },
  topicChipText: { fontSize: 11.5, fontWeight: "600", color: colors.textSecondary },
  topicChipTextOn: { color: "#fff" },
  center: {
    paddingVertical: 60,
    alignItems: "center",
    gap: spacing.md
  },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  emptyText: { fontSize: 13, color: colors.textTertiary },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg
  },
  sourceCardMain: { gap: 4 },
  sourceName: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  sourceCount: { fontSize: 13, fontWeight: "700", color: colors.brand600 },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  cardMain: {
    flex: 1,
    gap: 5
  },
  cardCover: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginTop: 2
  },
  cardPressed: { opacity: 0.78 },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  levelUnconfirmedBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  kindTag: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: "flex-start"
  },
  excerptBadge: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.amber700,
    backgroundColor: colors.amber50,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  nativeAudioBadge: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  metaText: { fontSize: 11.5, color: colors.textTertiary, marginTop: 2 },
  readBadge: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand600
  },
  resumeBadge: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "700",
    color: colors.indigo600
  },
  cardTitleZh: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    color: colors.text
  },
  cardSummary: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary
  },
  cardTitleOriginal: {
    fontSize: 11.5,
    color: colors.textTertiary
  }
});
