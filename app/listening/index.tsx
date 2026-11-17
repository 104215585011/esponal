// Timestamp: 2026-11-16 09:30
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
import { useFocusEffect, useRouter } from "expo-router";

import { fetchStories, type LecturaListItem, type LecturaLevel } from "@/api/lectura";
import {
  fetchPodcasts,
  getProxiedCoverUrl,
  type PodcastEpisode,
  type PodcastShow
} from "@/api/podcasts";
// Timestamp: 2026-11-17 15:58
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS } from "@/lib/preferences";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useBackgroundMedia } from "@/context/BackgroundMediaContext";
import {
  getStorySummary,
  loadListeningLog,
  type StorySummary
} from "@/lib/listeningProgress";
import { colors, radius, spacing } from "@/theme";

type ModeTab = "podcasts" | "curated";

const LEVELS: Array<LecturaLevel | "ALL"> = ["ALL", "A1", "A2", "B1"];

const LEVEL_LABEL: Record<LecturaLevel | "ALL", string> = {
  ALL: "全部",
  A1: "A1 入门",
  A2: "A2 基础",
  B1: "B1 进阶"
};

function formatDuration(sec: number | null) {
  if (!sec || sec <= 0) return "约 10 分钟";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(raw: string) {
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return "";
  try {
    return new Date(ts).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * 听力精听列表：
 * - 西语播客（默认）：真实西班牙语播客 RSS 直链 MP3（Hoy Hablamos / Español con Juan），支持 30 秒片段精听循环与变速
 * - 分级精听：内置 30 秒分段盲听材料（仅筛选静态带分段音频的故事）
 */
export default function ListeningListScreen() {
  const router = useRouter();
  const { activePodcast, podcastStatus } = useBackgroundMedia();
  const { learningLang } = usePreferences();
  const langLabel =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === learningLang)?.shortLabel ?? "目标语";
  const [mode, setMode] = useState<ModeTab>("podcasts");
  const reqSeqRef = useRef(0);
  const latestLangRef = useRef(learningLang);
  latestLangRef.current = learningLang;

  useEffect(() => {
    if (learningLang !== "es" && mode !== "podcasts") {
      setMode("podcasts");
    }
  }, [learningLang, mode]);

  // 播客状态
  const [shows, setShows] = useState<PodcastShow[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [showFilter, setShowFilter] = useState<string>("ALL");
  const [podLoading, setPodLoading] = useState(true);
  const [podError, setPodError] = useState<string | null>(null);
  const [podRefreshing, setPodRefreshing] = useState(false);

  // 分级短文精听状态
  const [items, setItems] = useState<LecturaListItem[]>([]);
  const [level, setLevel] = useState<LecturaLevel | "ALL">("ALL");
  const [curLoading, setCurLoading] = useState(true);
  const [curRefreshing, setCurRefreshing] = useState(false);
  const [curError, setCurError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, StorySummary>>({});
  const itemsRef = useRef<LecturaListItem[]>([]);

  const loadPodcasts = useCallback(async (isRefresh = false) => {
    const seq = ++reqSeqRef.current;
    const reqLang = learningLang;
    if (isRefresh) setPodRefreshing(true);
    else {
      setPodLoading(true);
      setShowFilter("ALL");
      setShows([]);
      setEpisodes([]);
    }
    setPodError(null);
    try {
      const res = await fetchPodcasts(isRefresh, reqLang);
      if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
      setShows(res.shows ?? []);
      setEpisodes(res.episodes ?? []);
    } catch (e) {
      if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
      setPodError(e instanceof Error ? e.message : "加载播客失败");
    } finally {
      if (seq === reqSeqRef.current) {
        setPodLoading(false);
        setPodRefreshing(false);
      }
    }
  }, [learningLang]);

  const refreshProgress = useCallback(async (list: LecturaListItem[]) => {
    await loadListeningLog();
    const next: Record<string, StorySummary> = {};
    list.forEach((item) => {
      next[item.slug] = getStorySummary(item.slug, item.paragraphCount);
    });
    setProgress(next);
  }, []);

  const loadCurated = useCallback(
    async (isRefresh = false) => {
      const reqLang = learningLang;
      if (reqLang !== "es") {
        setItems([]);
        setCurLoading(false);
        setCurRefreshing(false);
        return;
      }
      if (isRefresh) setCurRefreshing(true);
      else setCurLoading(true);
      setCurError(null);

      try {
        const data = await fetchStories(false, "es");
        if (reqLang !== latestLangRef.current) return;
        const audioCapable = data.filter((item) => item.sourceType !== "rss");
        itemsRef.current = audioCapable;
        setItems(audioCapable);
        await refreshProgress(audioCapable);
      } catch (e) {
        if (reqLang !== latestLangRef.current) return;
        setCurError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setCurLoading(false);
        setCurRefreshing(false);
      }
    },
    [learningLang, refreshProgress]
  );

  useEffect(() => {
    void loadPodcasts(false);
    void loadCurated(false);
  }, [loadPodcasts, loadCurated]);

  useFocusEffect(
    useCallback(() => {
      void refreshProgress(itemsRef.current);
    }, [refreshProgress])
  );

  const visibleEpisodes = useMemo(
    () =>
      showFilter === "ALL"
        ? episodes
        : episodes.filter((ep) => ep.showId === showFilter),
    [episodes, showFilter]
  );

  const filteredCurated = useMemo(
    () => (level === "ALL" ? items : items.filter((item) => item.level === level)),
    [items, level]
  );

  const totalTrained = useMemo(
    () => Object.values(progress).reduce((sum, item) => sum + item.trained, 0),
    [progress]
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{langLabel}听力精听</Text>
      </View>

      {learningLang === "es" ? (
        <View style={styles.segWrap}>
          <SegmentedControl
            onChange={setMode}
            options={[
              { key: "podcasts", label: "西语播客" },
              { key: "curated", label: "分级盲听" }
            ]}
            value={mode}
          />
        </View>
      ) : null}

      {mode === "podcasts" ? (
        <FlatList
          contentContainerStyle={styles.body}
          data={visibleEpisodes}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadPodcasts(true)}
              refreshing={podRefreshing}
              tintColor={colors.brand500}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.intro}>
                <Text style={styles.introTitle}>播客精听 · 真实{langLabel}输入</Text>
                <Text style={styles.introLine}>
                  来自{langLabel}原声与高口碑学习播客的最新音频。支持 30 秒循环、变速、源文稿字幕与熄屏连续播放。
                </Text>
              </View>

              {shows.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.showStrip}
                >
                  <Pressable
                    onPress={() => setShowFilter("ALL")}
                    style={[styles.showCard, showFilter === "ALL" && styles.showCardActive]}
                  >
                    <View style={styles.showAllIcon}>
                      <Text style={styles.showAllEmoji}>📻</Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.showCardTitle,
                        showFilter === "ALL" && styles.showCardTitleActive
                      ]}
                    >
                      全部节目
                    </Text>
                    <Text style={styles.showCardSub}>{episodes.length} 集更新</Text>
                  </Pressable>
                  {shows.map((show) => {
                    const active = showFilter === show.id;
                    const showCover = show.coverUrl
                      ? getProxiedCoverUrl(show.coverUrl) ?? show.coverUrl
                      : null;
                    return (
                      <Pressable
                        key={show.id}
                        onPress={() => setShowFilter(show.id)}
                        style={[styles.showCard, active && styles.showCardActive]}
                      >
                        {showCover ? (
                          <Image source={{ uri: showCover }} style={styles.showCover} />
                        ) : (
                          <View style={styles.showAllIcon}>
                            <Text style={styles.showAllEmoji}>🎙</Text>
                          </View>
                        )}
                        <Text
                          numberOfLines={1}
                          style={[styles.showCardTitle, active && styles.showCardTitleActive]}
                        >
                          {show.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.showCardSub}>
                          {show.level} · {show.host}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {podLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.brand500} />
                  <Text style={styles.emptyText}>正在拉取最新播客剧集…</Text>
                </View>
              ) : podError ? (
                <View style={styles.center}>
                  <Text style={styles.errorText}>{podError}</Text>
                  <Pressable onPress={() => void loadPodcasts(true)} style={styles.retry}>
                    <Text style={styles.retryText}>重试</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const epCover = item.coverUrl ? getProxiedCoverUrl(item.coverUrl) ?? item.coverUrl : null;
            const isCurrent = activePodcast?.rawAudioUrl === item.audioUrl;
            const isPlayingCurrent = isCurrent && podcastStatus.playing;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/listening/podcast",
                    params: {
                      id: item.id,
                      title: item.title,
                      showTitle: item.showTitle,
                      level: item.level,
                      audioUrl: item.audioUrl,
                      description: item.description,
                      durationSec: item.durationSec ? String(item.durationSec) : "",
                      coverUrl: item.coverUrl ?? "",
                      link: item.link ?? "",
                      language: item.language ?? learningLang
                    }
                  } as never)
                }
                style={({ pressed }) => [
                  styles.card,
                  isCurrent && styles.cardActive,
                  pressed && styles.cardPressed
                ]}
              >
                <View style={styles.epRow}>
                  {epCover ? (
                    <Image source={{ uri: epCover }} style={styles.epCover} resizeMode="cover" />
                  ) : (
                    <View style={styles.epCoverFallback}>
                      <Text style={styles.epCoverIcon}>🎧</Text>
                    </View>
                  )}

                  <View style={styles.epBody}>
                    <View style={styles.cardHead}>
                      <Text style={styles.levelBadge}>{item.level}</Text>
                      <Text style={styles.showBadge}>{item.showTitle}</Text>
                      {isCurrent ? (
                        <Text style={styles.liveBadge}>
                          {isPlayingCurrent ? "● 正在播放" : "已暂停"}
                        </Text>
                      ) : null}
                      <Text style={styles.cardMeta}>
                        {formatDuration(item.durationSec)}
                        {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}
                      </Text>
                    </View>

                    <Text numberOfLines={2} style={styles.cardTitle}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text numberOfLines={2} style={styles.cardSummary}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            podLoading || podError ? undefined : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>暂无播客剧集，下拉刷新试试</Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.body}
          data={filteredCurated}
          keyExtractor={(item) => item.slug}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadCurated(true)}
              refreshing={curRefreshing}
              tintColor={colors.brand500}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.intro}>
                <Text style={styles.introTitle}>怎么练（30 秒盲听法）</Text>
                <Text style={styles.introLine}>1. 先别看文本，盲听两遍</Text>
                <Text style={styles.introLine}>2. 揭晓原文，核对哪几个音没抓住</Text>
                <Text style={styles.introLine}>3. 自评听懂率 + 勾选错因</Text>
              </View>

              <View style={styles.levelRow}>
                {LEVELS.map((item) => {
                  const active = level === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setLevel(item)}
                      style={[styles.levelChip, active && styles.levelChipActive]}
                    >
                      <Text style={[styles.levelText, active && styles.levelTextActive]}>
                        {LEVEL_LABEL[item]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {totalTrained > 0 ? (
                <Text style={styles.trainedNote}>你在这些材料里已经精听过 {totalTrained} 段</Text>
              ) : null}

              {curLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.brand500} />
                </View>
              ) : curError ? (
                <View style={styles.center}>
                  <Text style={styles.errorText}>{curError}</Text>
                  <Pressable onPress={() => void loadCurated(false)} style={styles.retry}>
                    <Text style={styles.retryText}>重试</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const summary = progress[item.slug];
            const trained = summary?.trained ?? 0;
            const done = trained > 0 && trained >= item.paragraphCount;

            return (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/listening/[slug]", params: { slug: item.slug } } as never)
                }
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.levelBadge}>{item.level}</Text>
                  <Text style={styles.cardMeta}>
                    {item.paragraphCount} 段 · {item.durationMin} 分钟
                  </Text>
                  {done ? <Text style={styles.doneBadge}>练完</Text> : null}
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardTitleZh}>{item.titleZh}</Text>

                <View style={styles.progressRow}>
                  {trained === 0 ? (
                    <Text style={styles.progressIdle}>未开始</Text>
                  ) : (
                    <>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(100, (trained / item.paragraphCount) * 100)}%` }
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        已练 {trained}/{item.paragraphCount} 段
                        {summary?.average !== null && summary?.average !== undefined
                          ? ` · 平均 ${summary.average}%`
                          : ""}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            curLoading || curError ? undefined : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>这一档还没有材料</Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  segWrap: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xs },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  intro: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6
  },
  introTitle: { fontSize: 13, fontWeight: "800", color: colors.brand700 },
  introLine: { fontSize: 12.5, lineHeight: 19, color: colors.brand700 },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  levelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  levelChipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  levelText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  levelTextActive: { color: "#FFFFFF" },
  showStrip: { marginTop: spacing.md, paddingRight: spacing.lg, gap: 10 },
  showCard: {
    width: 112,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 5
  },
  showCardActive: {
    borderColor: colors.brand500,
    backgroundColor: colors.brand50
  },
  showCover: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted
  },
  showAllIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  showAllEmoji: { fontSize: 22 },
  showCardTitle: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  showCardTitleActive: { color: colors.brand700 },
  showCardSub: { fontSize: 11, color: colors.textTertiary },
  trainedNote: { marginTop: spacing.md, fontSize: 12, color: colors.textTertiary },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4
  },
  cardActive: {
    borderColor: colors.brand500,
    backgroundColor: "#F0FDF4"
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  epRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  epCover: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted
  },
  epCoverFallback: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  epCoverIcon: { fontSize: 28 },
  epBody: { flex: 1, gap: 3 },
  liveBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#059669",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  cardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  levelBadge: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden"
  },
  showBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden"
  },
  cardMeta: { marginLeft: "auto", fontSize: 11.5, color: colors.textTertiary },
  doneBadge: { fontSize: 10.5, fontWeight: "700", color: colors.brand600 },
  cardTitle: { marginTop: 4, fontSize: 15.5, fontWeight: "700", color: colors.text, lineHeight: 21 },
  cardTitleZh: { fontSize: 12.5, color: colors.textSecondary },
  cardSummary: { marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  progressRow: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressIdle: { fontSize: 11.5, color: colors.textTertiary },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brand500 },
  progressText: { fontSize: 11.5, color: colors.textSecondary },
  center: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  retryText: { fontSize: 13, fontWeight: "600", color: colors.brand700 },
  emptyText: { fontSize: 13, color: colors.textTertiary }
});
