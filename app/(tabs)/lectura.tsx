// Timestamp: 2026-11-17 23:16
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

import { fetchStories, type LecturaListItem, type LecturaLevel } from "@/api/lectura";
import { getProxiedCoverUrl } from "@/api/podcasts";
import { ImportShelfPanel } from "@/components/ImportShelfPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS, type LearningLanguage } from "@/lib/preferences";
import { colors, radius, spacing } from "@/theme";

type ReadTab = "stories" | "shelf";
type FilterKey = "ALL" | "RSS" | LecturaLevel;

const RSS_LABEL_BY_LANG: Record<LearningLanguage, string> = {
  es: "西媒实时",
  de: "德语博客",
  en: "Guardian",
  fr: "RFI 法语",
  ja: "NHK 新闻"
};

/**
 * 阅读 Tab：合并「精选短文（含西媒 RSS 爬虫） / 我的书架（导入 EPUB·PDF）」。
 * 传 `?tab=shelf` 可直达个人书架。
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

  const [subTab, setSubTab] = useState<ReadTab>(params.tab === "shelf" ? "shelf" : "stories");

  useEffect(() => {
    if (params.tab === "shelf") setSubTab("shelf");
    else if (params.tab === "stories") setSubTab("stories");
  }, [params.tab]);

  const [items, setItems] = useState<LecturaListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    const seq = ++reqSeqRef.current;
    const reqLang = learningLang;
    if (isRefresh) setRefreshing(true);
    else {
      setLoading(true);
      setItems([]);
      setFilter("ALL");
    }
    setError(null);

    try {
      const data = await fetchStories(isRefresh, reqLang);
      if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
      setItems(data);
    } catch (e) {
      if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [learningLang]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const filters = useMemo<Array<{ key: FilterKey; label: string }>>(
    () => [
      { key: "ALL", label: "全部" },
      { key: "RSS", label: RSS_LABEL_BY_LANG[learningLang] ?? "实时新闻" },
      { key: "A1", label: "A1 入门" },
      { key: "A2", label: "A2 基础" },
      { key: "B1", label: "B1 进阶" }
    ],
    [learningLang]
  );

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "RSS") return items.filter((item) => item.sourceType === "rss");
    return items.filter((item) => item.level === filter);
  }, [items, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topHeader}>
        <Text style={styles.eyebrow}>Lectura · {langLabel}</Text>
        <Text style={styles.title}>{learningLang === "es" ? "阅读" : `${langLabel}阅读`}</Text>
        <View style={styles.segWrap}>
          <SegmentedControl
            onChange={setSubTab}
            options={[
              { key: "stories", label: "精选短文" },
              { key: "shelf", label: "我的书架" }
            ]}
            value={subTab}
          />
        </View>
      </View>

      {subTab === "shelf" ? (
        <ImportShelfPanel />
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
                <Text style={styles.emptyText}>这个分类暂时没有文章，下拉刷新试试</Text>
              </View>
            )
          }
          ListHeaderComponent={
            <View style={styles.storiesHeader}>
              <Text style={styles.subtitle}>
                实时抓取{langLabel}博客/外刊与分级短文，点击任意单词可查词与收藏。
              </Text>
              <ScrollView
                contentContainerStyle={styles.chips}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {filters.map((item) => {
                  const on = filter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setFilter(item.key)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
            const isRss = item.sourceType === "rss";
            const cover = item.coverUrl ? getProxiedCoverUrl(item.coverUrl) ?? item.coverUrl : null;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/lectura/[slug]",
                    params: { slug: item.slug, lang: item.language ?? learningLang }
                  } as never)
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardMain}>
                    <View style={styles.badges}>
                      <Text style={styles.levelBadge}>{item.level}</Text>
                      {isRss ? <Text style={styles.rssBadge}>{item.source}</Text> : null}
                      <Text style={styles.metaText}>
                        {item.durationMin} 分钟 · {item.paragraphCount} 段
                      </Text>
                      {item.isRead ? <Text style={styles.readBadge}>已读</Text> : null}
                    </View>

                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardTitleZh}>{item.titleZh}</Text>
                    <Text numberOfLines={2} style={styles.cardSummary}>
                      {item.summaryZh}
                    </Text>
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
  chips: {
    marginTop: spacing.md,
    flexDirection: "row",
    gap: spacing.sm
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    gap: 6
  },
  cardCover: {
    width: 86,
    height: 86,
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
  rssBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  metaText: { fontSize: 11.5, color: colors.textTertiary },
  readBadge: {
    marginLeft: "auto",
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand600
  },
  cardTitle: {
    marginTop: 2,
    fontSize: 16.5,
    fontWeight: "700",
    color: colors.text
  },
  cardTitleZh: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.textSecondary
  },
  cardSummary: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textTertiary
  }
});
