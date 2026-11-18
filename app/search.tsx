// Timestamp: 2026-11-14 23:45
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// Timestamp: 2026-11-17 15:40
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { searchVideos } from "@/api/search";
import { formatDuration, type VideoItem } from "@/api/watch";
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS, type LearningLanguage } from "@/lib/preferences";
import { getAllWatchProgress, loadWatchProgress, shouldResume, type WatchProgress } from "@/lib/watchProgress";
import { colors, radius, spacing } from "@/theme";

// Timestamp: 2026-11-18 09:24
/** 一键试搜的主题词(按语种区分，全部使用英文检索词以避免命中中文讲解作者) */
const SUGGESTIONS_BY_LANG: Record<LearningLanguage, string[]> = {
  de: [
    "Easy German A1",
    "DW Deutsch lernen",
    "Learn German Original",
    "Slow German listening",
    "German daily conversation",
    "Nicos Weg A1 German",
    "German comprehensible input",
    "German podcast beginner"
  ],
  en: [
    "BBC Learning English",
    "VOA Learning English",
    "Speak English With Vanessa",
    "6 Minute English",
    "Everyday English conversation",
    "English listening practice A2",
    "British English daily vlog",
    "English podcast beginner"
  ],
  fr: [
    "Easy French A1",
    "Slow French listening",
    "innerFrench podcast",
    "French daily conversation",
    "RFI simple French",
    "French beginner vlog",
    "French comprehensible input",
    "Paris travel vlog French"
  ],
  ja: [
    "Japanese with Shun",
    "Speak Japanese Naturally",
    "Miku Real Japanese",
    "JLPT N5 listening",
    "Slow Japanese conversation",
    "Nihongo con Teppei",
    "Beginner Japanese vlog",
    "Japanese comprehensible input"
  ],
  es: [
    "Slow Spanish listening",
    "Spanish daily conversation",
    "Easy Spanish street interview",
    "Spanish comprehensible input A1",
    "Spanish travel vlog",
    "Spanish news slow",
    "Dreaming Spanish beginner",
    "Spanish podcast beginner"
  ]
};

const SEARCH_PLACEHOLDER_EXAMPLE: Record<LearningLanguage, string> = {
  es: "Slow Spanish listening",
  de: "Easy German A1",
  en: "BBC Learning English",
  fr: "Easy French A1",
  ja: "Japanese with Shun"
};

/**
 * 视频搜索页。
 *
 * 之前只能看三个固定频道,内容池太小;这里接服务端 /api/youtube/search
 * (带 24h 缓存,同一关键词不重复烧配额),搜索结果点开直接进播放页。
 */
export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ lang?: string }>();
  const { learningLang } = usePreferences();
  const activeLang: LearningLanguage =
    params.lang === "de" || params.lang === "es" || params.lang === "en" || params.lang === "fr" || params.lang === "ja"
      ? params.lang
      : learningLang;
  const langLabel =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === activeLang)?.shortLabel ?? "目标语";
  const suggestions = SUGGESTIONS_BY_LANG[activeLang] ?? SUGGESTIONS_BY_LANG.es!;

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [nextPage, setNextPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 搜索结果里也标出「看了一半」——只加一条细进度条，小缩略图放不下文字 */
  const [progress, setProgress] = useState<Record<string, WatchProgress>>({});

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await loadWatchProgress();
        setProgress(getAllWatchProgress());
      })();
    }, [])
  );

  const runSearch = useCallback(async (keyword: string) => {
    const q = keyword.trim();
    if (!q) return;

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setSubmitted(q);

    try {
      const res = await searchVideos(q, { language: activeLang });
      setVideos(res.videos ?? []);
      setNextPage(res.nextPageToken ?? "");
      if ((res.videos ?? []).length === 0) setError("没搜到结果,换个关键词试试");
    } catch (e) {
      setVideos([]);
      setNextPage("");
      setError(e instanceof Error ? e.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  }, [activeLang]);

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore || !submitted) return;
    setLoadingMore(true);
    try {
      const res = await searchVideos(submitted, { pageToken: nextPage, language: activeLang });
      setVideos((prev) => [...prev, ...(res.videos ?? [])]);
      setNextPage(res.nextPageToken ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载更多失败");
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore, submitted, activeLang]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : spacing.sm }]}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.inputWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            autoFocus
            enterKeyHint="search"
            onChangeText={setQuery}
            onSubmitEditing={() => void runSearch(query)}
            placeholder={`搜${langLabel}视频,如 ${SEARCH_PLACEHOLDER_EXAMPLE[activeLang]}`}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {query ? (
            <Pressable hitSlop={8} onPress={() => setQuery("")}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => void runSearch(query)}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <Text style={styles.searchButtonText}>搜索</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.hint}>正在搜索…(首次搜索可能要几秒)</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.emptyWrap}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.emptyTitle}>试试这些方向</Text>
          <View style={styles.chips}>
            {suggestions.map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setQuery(item);
                  void runSearch(item);
                }}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.tip}>
            搜索结果带 24 小时缓存,同样的词重复搜不会多耗额度。
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={videos}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            nextPage ? (
              <Pressable
                disabled={loadingMore}
                onPress={() => void loadMore()}
                style={styles.moreButton}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.brand500} size="small" />
                ) : (
                  <Text style={styles.moreText}>加载更多</Text>
                )}
              </Pressable>
            ) : (
              <Text style={styles.endText}>— 没有更多了 —</Text>
            )
          }
          renderItem={({ item }) => {
            const saved = progress[item.id];
            const resumable = shouldResume(saved);
            const pct =
              resumable && saved && saved.duration > 0
                ? Math.min(100, (saved.position / saved.duration) * 100)
                : 0;

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/watch/[videoId]",
                    params: {
                      videoId: item.id,
                      title: item.title,
                      channelTitle: item.channelTitle,
                      thumbnail: item.thumbnail,
                      lang: activeLang
                    }
                  } as never)
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
                  {item.duration ? (
                    <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
                  ) : null}
                  {resumable ? (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(3, pct)}%` }]} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.rowText}>
                  <Text numberOfLines={2} style={styles.rowTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowChannel}>
                    {item.channelTitle}
                  </Text>
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
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  backHit: { width: 28, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12
  },
  searchIcon: { fontSize: 12 },
  input: { flex: 1, fontSize: 13.5, color: colors.text, padding: 0 },
  clearIcon: { fontSize: 12, color: colors.textTertiary },
  searchButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: { opacity: 0.7 },
  searchButtonText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  hint: { fontSize: 12.5, color: colors.textTertiary },
  emptyWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.md,
    lineHeight: 20
  },
  emptyTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  chipPressed: { backgroundColor: colors.brand50 },
  chipText: { fontSize: 12.5, color: colors.textSecondary },
  tip: { marginTop: spacing.lg, fontSize: 11.5, lineHeight: 18, color: colors.textTertiary },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md },
  rowPressed: { opacity: 0.7 },
  thumbWrap: { width: 132, height: 74, borderRadius: radius.sm, overflow: "hidden", backgroundColor: "#000" },
  thumb: { width: "100%", height: "100%" },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)"
  },
  progressFill: { height: "100%", backgroundColor: colors.brand500 },
  duration: {
    position: "absolute",
    right: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.72)",
    fontSize: 9.5,
    fontWeight: "700",
    color: "#fff",
    overflow: "hidden"
  },
  rowText: { flex: 1, justifyContent: "center", gap: 4 },
  rowTitle: { fontSize: 13.5, fontWeight: "600", lineHeight: 19, color: colors.text },
  rowChannel: { fontSize: 11.5, color: colors.textTertiary },
  moreButton: {
    marginTop: spacing.md,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  moreText: { fontSize: 13, fontWeight: "600", color: colors.brand600 },
  endText: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontSize: 11.5,
    color: colors.textTertiary
  }
});
