// Timestamp: 2026-11-17 23:14
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import {
  fetchVideoFeed,
  formatDuration,
  type VideoFeedResponse,
  type VideoItem
} from "@/api/watch";
import { AppIcon } from "@/components/AppIcon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { usePreferences } from "@/hooks/usePreferences";
import { LEARNING_LANGUAGE_OPTIONS, type LearningLanguage } from "@/lib/preferences";
import {
  formatPosition,
  getAllWatchProgress,
  loadWatchProgress,
  shouldResume,
  type WatchProgress
} from "@/lib/watchProgress";
import { colors, radius, spacing } from "@/theme";

type ViewMode = "feed" | "channels";

type WatchSessionState = {
  feed: VideoFeedResponse | null;
  seed: number;
  selectedLevel: string;
  selectedChannelId: string | null;
  viewMode: ViewMode;
  scrollY: number;
};

/** 浏览会话级缓存：进视频再返回时保留当前混排列表、筛选条件与滚动位置，主动刷新才换批 */
const feedSessionCache: Partial<Record<LearningLanguage, WatchSessionState>> = {};

const LEVEL_BADGE_COLORS: Record<string, string> = {
  A1: "#059669",
  A2: "#0284C7",
  B1: "#D97706"
};

function defaultSeed() {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

function parseVideoIdInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const segments = url.pathname.split("/").filter(Boolean);
    const tail = segments[segments.length - 1];
    if (url.hostname.includes("youtu.be") && tail && /^[a-zA-Z0-9_-]{11}$/.test(tail)) {
      return tail;
    }
    if (
      (segments[0] === "shorts" || segments[0] === "embed") &&
      segments[1] &&
      /^[a-zA-Z0-9_-]{11}$/.test(segments[1])
    ) {
      return segments[1];
    }
  } catch {
    return null;
  }
  return null;
}

export default function WatchScreen() {
  const router = useRouter();
  const { learningLang } = usePreferences();
  const langLabel =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === learningLang)?.shortLabel ?? "目标语";

  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const scrollYRef = useRef(0);
  const reqSeqRef = useRef(0);
  const latestLangRef = useRef(learningLang);
  latestLangRef.current = learningLang;

  const initialSession = feedSessionCache[learningLang];
  const [feed, setFeed] = useState<VideoFeedResponse | null>(initialSession?.feed ?? null);
  const [seed, setSeed] = useState<number>(() => initialSession?.seed ?? defaultSeed());
  const [selectedLevel, setSelectedLevel] = useState<string>(
    initialSession?.selectedLevel ?? "all"
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialSession?.selectedChannelId ?? null
  );
  const [viewMode, setViewMode] = useState<ViewMode>(initialSession?.viewMode ?? "feed");

  const [loading, setLoading] = useState(!initialSession?.feed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [progress, setProgress] = useState<Record<string, WatchProgress>>({});

  const refreshProgress = useCallback(async () => {
    await loadWatchProgress();
    setProgress(getAllWatchProgress());
  }, []);

  const persistSession = useCallback(
    (langKey: LearningLanguage, patch: Partial<WatchSessionState>) => {
      const prev = feedSessionCache[langKey] ?? {
        feed: null,
        seed: defaultSeed(),
        selectedLevel: "all",
        selectedChannelId: null,
        viewMode: "feed" as ViewMode,
        scrollY: 0
      };
      feedSessionCache[langKey] = { ...prev, ...patch };
    },
    []
  );

  const loadFeed = useCallback(
    async (opts: {
      reqLang: LearningLanguage;
      level: string;
      channelId: string | null;
      nextSeed: number;
      isRefresh?: boolean;
    }) => {
      const seq = ++reqSeqRef.current;
      if (opts.isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      void refreshProgress();

      try {
        const res = await fetchVideoFeed({
          lang: opts.reqLang,
          level: opts.level,
          channelId: opts.channelId,
          seed: opts.nextSeed
        });
        if (seq !== reqSeqRef.current || opts.reqLang !== latestLangRef.current) return;
        setFeed(res);
        persistSession(opts.reqLang, {
          feed: res,
          seed: opts.nextSeed,
          selectedLevel: opts.level,
          selectedChannelId: opts.channelId
        });
      } catch (e) {
        if (seq !== reqSeqRef.current || opts.reqLang !== latestLangRef.current) return;
        setError(e instanceof Error ? e.message : "加载视频失败");
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [persistSession, refreshProgress]
  );

  // 切换学习语种或首次加载时：优先复用当前会话缓存（不打乱已有浏览列表），没有缓存再请求共用 API
  useEffect(() => {
    const cached = feedSessionCache[learningLang];
    if (cached?.feed) {
      setFeed(cached.feed);
      setSeed(cached.seed);
      setSelectedLevel(cached.selectedLevel);
      setSelectedChannelId(cached.selectedChannelId);
      setViewMode(cached.viewMode);
      setLoading(false);
      void refreshProgress();
      return;
    }

    const freshSeed = defaultSeed();
    setFeed(null);
    setSeed(freshSeed);
    setSelectedLevel("all");
    setSelectedChannelId(null);
    setViewMode("feed");
    void loadFeed({
      reqLang: learningLang,
      level: "all",
      channelId: null,
      nextSeed: freshSeed
    });
  }, [learningLang, loadFeed, refreshProgress]);

  // 从播放页返回时：不重新抓列表（保持列表稳定），仅补刷播放进度并恢复原先滚动位置
  useFocusEffect(
    useCallback(() => {
      void refreshProgress();
      const savedY = feedSessionCache[latestLangRef.current]?.scrollY ?? 0;
      if (savedY > 0) {
        const timer = setTimeout(() => {
          scrollRef.current?.scrollTo({ y: savedY, animated: false });
        }, 40);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [refreshProgress])
  );

  const openVideoPlayer = useCallback(
    (video: VideoItem) => {
      persistSession(learningLang, { scrollY: scrollYRef.current });
      router.push({
        pathname: "/watch/[videoId]",
        params: {
          videoId: video.id,
          title: video.title,
          channelTitle: video.channelTitle,
          thumbnail: video.thumbnail,
          lang: video.language ?? learningLang
        }
      } as never);
    },
    [learningLang, persistSession, router]
  );

  const handleSelectLevel = (nextLevel: string) => {
    if (nextLevel === selectedLevel) return;
    setSelectedLevel(nextLevel);
    scrollYRef.current = 0;
    persistSession(learningLang, { selectedLevel: nextLevel, scrollY: 0 });
    void loadFeed({
      reqLang: learningLang,
      level: nextLevel,
      channelId: selectedChannelId,
      nextSeed: seed
    });
  };

  const handleSelectChannel = (channelId: string | null) => {
    setSelectedChannelId(channelId);
    setSelectedLevel("all");
    scrollYRef.current = 0;
    persistSession(learningLang, {
      selectedChannelId: channelId,
      selectedLevel: "all",
      scrollY: 0
    });
    void loadFeed({
      reqLang: learningLang,
      level: "all",
      channelId,
      nextSeed: seed
    });
  };

  const handleShuffleBatch = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    scrollYRef.current = 0;
    persistSession(learningLang, { seed: nextSeed, scrollY: 0 });
    void loadFeed({
      reqLang: learningLang,
      level: selectedLevel,
      channelId: selectedChannelId,
      nextSeed,
      isRefresh: true
    });
  };

  const handleModeChange = (nextMode: ViewMode) => {
    setViewMode(nextMode);
    persistSession(learningLang, { viewMode: nextMode });
    if (nextMode === "feed" && selectedChannelId) {
      handleSelectChannel(null);
    }
  };

  const levelPills = useMemo(() => {
    const allLabel = learningLang === "es" ? "全部" : `${langLabel}精选`;
    const available = feed?.availableLevels ?? [];
    return [
      { key: "all", label: allLabel },
      ...available.map((lvl) => ({ key: lvl, label: lvl }))
    ];
  }, [learningLang, langLabel, feed?.availableLevels]);

  const activeChannel = useMemo(
    () => feed?.channels.find((c) => c.id === selectedChannelId) ?? null,
    [feed?.channels, selectedChannelId]
  );

  const spotlight = useMemo(
    () => feed?.videos[0] ?? feed?.nearbyVideos[0] ?? null,
    [feed?.videos, feed?.nearbyVideos]
  );

  const renderVideoCard = (video: VideoItem, keyPrefix = "") => {
    const saved = progress[video.id];
    const resumable = shouldResume(saved);
    const pct =
      resumable && saved && saved.duration > 0
        ? Math.min(100, (saved.position / saved.duration) * 100)
        : 0;
    const lvlColor = video.level ? LEVEL_BADGE_COLORS[video.level] : undefined;

    return (
      <Pressable
        key={`${keyPrefix}${video.id}`}
        onPress={() => openVideoPlayer(video)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.thumbWrap}>
          <Image source={{ uri: video.thumbnail }} style={styles.thumb} />
          {video.level && lvlColor ? (
            <View style={[styles.videoLevelBadge, { backgroundColor: lvlColor }]}>
              <Text style={styles.videoLevelText}>{video.level}</Text>
            </View>
          ) : null}
          {video.duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
            </View>
          ) : null}

          {resumable && saved ? (
            <>
              <View style={styles.resumeBadge}>
                <Text style={styles.resumeText}>看到 {formatPosition(saved.position)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(3, pct)}%` }]} />
              </View>
            </>
          ) : null}
        </View>
        <View style={styles.cardBody}>
          <Text numberOfLines={2} style={styles.videoTitle}>
            {video.title}
          </Text>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.videoMeta}>
              {video.channelTitle}
            </Text>
            {video.topic ? (
              <View style={styles.topicChip}>
                <Text style={styles.topicText}>{video.topic}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
          persistSession(learningLang, { scrollY: scrollYRef.current });
        }}
        scrollEventThrottle={120}
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={handleShuffleBatch}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>Video · {langLabel}</Text>
            <Text style={styles.title}>{learningLang === "de" ? "德语视频" : "推荐视频"}</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          跨频道混排精选，难度标在每条视频上。进出播放保持当前列表与位置。
        </Text>

        {/* 推荐混排 vs 独立频道目录 */}
        <View style={styles.segWrap}>
          <SegmentedControl
            onChange={handleModeChange}
            options={[
              { key: "feed", label: "推荐混排" },
              {
                key: "channels",
                label: `频道 (${feed?.channels.length ?? 3})`
              }
            ]}
            value={viewMode}
          />
        </View>

        {/* 搜索入口 */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/search", params: { lang: learningLang } } as never)
          }
          style={({ pressed }) => [styles.searchBar, pressed && styles.cardPressed]}
        >
          <AppIcon color={colors.textTertiary} name="search" size={16} />
          <Text style={styles.searchPlaceholder}>搜任意{langLabel}视频…</Text>
        </Pressable>

        {/* 贴 YouTube 链接直看 */}
        <View style={styles.linkRow}>
          <TextInput
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="粘贴 YouTube 链接或视频 ID…"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.linkInput}
          />
          <Pressable
            onPress={() => {
              const id = parseVideoIdInput(linkInput);
              if (!id) {
                Alert.alert("链接无效", "请粘贴有效的 YouTube 链接或 11 位视频 ID");
                return;
              }
              setLinkInput("");
              router.push({
                pathname: "/watch/[videoId]",
                params: { videoId: id, lang: learningLang }
              } as never);
            }}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.cardPressed]}
          >
            <Text style={styles.linkBtnText}>打开</Text>
          </Pressable>
        </View>

        {/* 独立频道目录列表（未选定某个频道时） */}
        {viewMode === "channels" && !selectedChannelId ? (
          <View style={styles.channelDirList}>
            {(feed?.channels ?? []).map((ch) => (
              <Pressable
                key={ch.id}
                onPress={() => handleSelectChannel(ch.id)}
                style={({ pressed }) => [styles.channelDirCard, pressed && styles.cardPressed]}
              >
                <View style={styles.channelDirHead}>
                  <Text style={styles.channelTitle}>{ch.title}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{ch.tag}</Text>
                  </View>
                </View>
                <Text style={styles.channelDirDesc}>{ch.description}</Text>
                <Text style={styles.channelDirLink}>进入频道看全部视频 ›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            {!loading && spotlight ? (
              <View style={styles.discoveryCard}>
                <Text style={styles.discoveryEyebrow}>
                  {activeChannel ? `频道精选 · ${activeChannel.title}` : "随机挑一集"}
                </Text>
                <Text numberOfLines={2} style={styles.discoveryTitle}>
                  {spotlight.title}
                </Text>
                <Text style={styles.discoveryMeta}>
                  {spotlight.channelTitle}
                  {spotlight.level ? ` · ${spotlight.level}` : ""}
                  {spotlight.duration ? ` · ${formatDuration(spotlight.duration)}` : ""}
                </Text>
                <View style={styles.discoveryActions}>
                  {!activeChannel ? (
                    <Pressable
                      onPress={handleShuffleBatch}
                      style={({ pressed }) => [styles.shuffleBtn, pressed && styles.cardPressed]}
                    >
                      <Text style={styles.shuffleBtnText}>换一批推荐</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleSelectChannel(null)}
                      style={({ pressed }) => [styles.shuffleBtn, pressed && styles.cardPressed]}
                    >
                      <Text style={styles.shuffleBtnText}>返回跨频道混排</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => openVideoPlayer(spotlight)}
                    style={({ pressed }) => [styles.playNowBtn, pressed && styles.cardPressed]}
                  >
                    <Text style={styles.playNowBtnText}>立即观看 →</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* 难度筛选（挂在单条视频上；德语未达阈值暂只显示精选） */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {levelPills.map((item) => {
                const active = selectedLevel === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => handleSelectLevel(item.key)}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.brand500} />
                <Text style={styles.loadingText}>正在加载混排视频…</Text>
              </View>
            ) : error ? (
              <View style={styles.loadingBox}>
                <Text style={styles.sectionError}>{error}</Text>
                <Pressable
                  onPress={() =>
                    void loadFeed({
                      reqLang: learningLang,
                      level: selectedLevel,
                      channelId: selectedChannelId,
                      nextSeed: seed
                    })
                  }
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>重试</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {feed?.isSparse ? (
                  <View style={styles.sparseNotice}>
                    <Text style={styles.sparseNoticeText}>
                      当前「{feed.level}」共 {feed.videos.length} 条可用视频，已在下方附带相近难度推荐。
                    </Text>
                  </View>
                ) : null}

                {feed && feed.videos.length > 0 ? (
                  <View style={styles.section}>
                    {feed.videos.map((video) => renderVideoCard(video))}
                  </View>
                ) : (
                  <View style={styles.loadingBox}>
                    <Text style={styles.loadingText}>
                      当前筛选暂无可用视频，可以看看下方相近难度推荐。
                    </Text>
                  </View>
                )}

                {feed && feed.nearbyVideos.length > 0 ? (
                  <View style={styles.nearbySection}>
                    <View style={styles.nearbyHeader}>
                      <Text style={styles.channelTitle}>
                        相近难度推荐（{feed.nearbyLevel}）
                      </Text>
                      {feed.nearbyLevel ? (
                        <Pressable onPress={() => handleSelectLevel(feed.nearbyLevel!)}>
                          <Text style={styles.channelDirLink}>全部 {feed.nearbyLevel} ›</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {feed.nearbyVideos.map((video) => renderVideoCard(video, "nearby-"))}
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
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
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 20
  },
  segWrap: {
    marginTop: spacing.md
  },
  searchBar: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 11
  },
  searchPlaceholder: { fontSize: 13.5, color: colors.textTertiary },
  linkRow: {
    marginTop: spacing.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  linkInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text
  },
  linkBtn: {
    backgroundColor: colors.brand600,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 10
  },
  linkBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  channelDirList: {
    marginTop: spacing.lg,
    gap: spacing.md
  },
  channelDirCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8
  },
  channelDirHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  channelDirDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary
  },
  channelDirLink: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.brand600
  },
  discoveryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.brand100,
    padding: spacing.lg,
    gap: 6
  },
  discoveryEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand600,
    letterSpacing: 0.6
  },
  discoveryTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    color: colors.text
  },
  discoveryMeta: {
    fontSize: 12,
    color: colors.textSecondary
  },
  discoveryActions: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm
  },
  shuffleBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 9,
    alignItems: "center"
  },
  shuffleBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  playNowBtn: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.brand600,
    paddingVertical: 9,
    alignItems: "center"
  },
  playNowBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff"
  },
  filterRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
    paddingVertical: 2
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  filterPillActive: {
    borderColor: colors.brand600,
    backgroundColor: colors.brand600
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary
  },
  filterPillTextActive: {
    color: "#fff"
  },
  sparseNotice: {
    marginTop: spacing.md,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  sparseNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.amber700
  },
  loadingBox: {
    marginTop: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm
  },
  loadingText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand600
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  section: { marginTop: spacing.lg },
  nearbySection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  channelTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  levelBadge: {
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  levelBadgeText: { fontSize: 11, fontWeight: "700", color: colors.brand700 },
  sectionError: { fontSize: 13, color: colors.danger, paddingVertical: spacing.sm },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md
  },
  cardPressed: { opacity: 0.85 },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted },
  videoLevelBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  videoLevelText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff"
  },
  durationBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  durationText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  resumeBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  resumeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(15, 23, 42, 0.25)"
  },
  progressFill: { height: 3, backgroundColor: colors.brand500 },
  cardBody: { padding: spacing.md, gap: 6 },
  videoTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21, color: colors.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  videoMeta: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  topicChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  topicText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary
  }
});
