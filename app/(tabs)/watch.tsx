// Timestamp: 2026-11-15 02:45
import { useCallback, useEffect, useMemo, useState } from "react";
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

import { curatedChannels, fetchChannelVideos, formatDuration, type VideoItem } from "@/api/watch";
import { AppIcon } from "@/components/AppIcon";
import {
  formatPosition,
  getAllWatchProgress,
  loadWatchProgress,
  shouldResume,
  type WatchProgress
} from "@/lib/watchProgress";
import { colors, radius, spacing } from "@/theme";

type ChannelState = {
  id: string;
  title: string;
  hint: string;
  level: string;
  videos: VideoItem[];
  error: string | null;
};

function getFreshnessLabel(videos: VideoItem[]) {
  const latest = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];
  if (!latest) return null;
  const ageDays = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  if (ageDays <= 45) return "近期更新";
  if (ageDays >= 180) return "经典合集";
  return "精选片库";
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
    if ((segments[0] === "shorts" || segments[0] === "embed") && segments[1] && /^[a-zA-Z0-9_-]{11}$/.test(segments[1])) {
      return segments[1];
    }
  } catch {
    return null;
  }
  return null;
}

export default function WatchScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelState[]>(
    curatedChannels.map((c) => ({ ...c, videos: [], error: null }))
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("全部");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [linkInput, setLinkInput] = useState("");
  /** 观看进度只读快照：列表本身不拉接口，只从本地缓存取，避免每张卡片一次请求 */
  const [progress, setProgress] = useState<Record<string, WatchProgress>>({});

  const allVideos = useMemo(() => channels.flatMap((c) => c.videos), [channels]);
  const featuredVideo = useMemo(() => {
    if (allVideos.length === 0) return null;
    return allVideos[shuffleSeed % allVideos.length];
  }, [allVideos, shuffleSeed]);

  const levels = useMemo(() => ["全部", ...curatedChannels.map((c) => c.level)], []);

  const visibleChannels = useMemo(() => {
    const filtered =
      selectedLevel === "全部"
        ? channels
        : channels.filter((c) => c.level === selectedLevel);
    if (shuffleSeed === 0) return filtered;
    return filtered.map((c) => {
      if (c.videos.length <= 1) return c;
      const offset = shuffleSeed % c.videos.length;
      return { ...c, videos: [...c.videos.slice(offset), ...c.videos.slice(0, offset)] };
    });
  }, [channels, selectedLevel, shuffleSeed]);

  const refreshProgress = useCallback(async () => {
    await loadWatchProgress();
    setProgress(getAllWatchProgress());
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    // 从播放页返回时进度已经落盘，这里顺手刷一次，不用等下拉刷新
    void refreshProgress();

    const next = await Promise.all(
      curatedChannels.map(async (channel) => {
        try {
          const videos = await fetchChannelVideos(channel.id, 8);
          return { ...channel, videos, error: null };
        } catch (e) {
          return {
            ...channel,
            videos: [],
            error: e instanceof Error ? e.message : "加载失败"
          };
        }
      })
    );

    setChannels(next);
    setLoading(false);
    setRefreshing(false);
  }, [refreshProgress]);

  useEffect(() => {
    load();
  }, [load]);

  // 从播放页返回时列表不会重新挂载，回到前台补刷一次进度
  useFocusEffect(
    useCallback(() => {
      void refreshProgress();
    }, [refreshProgress])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={() => load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
      >
        <Text style={styles.eyebrow}>Video</Text>
        <Text style={styles.title}>视频</Text>
        <Text style={styles.subtitle}>
          精选西语频道,配逐句字幕。点视频进入播放页,点单词直接查词。
        </Text>

        {/* 搜索入口 */}
        <Pressable
          onPress={() => router.push("/search" as never)}
          style={({ pressed }) => [styles.searchBar, pressed && styles.cardPressed]}
        >
          <AppIcon color={colors.textTertiary} name="search" size={16} />
          <Text style={styles.searchPlaceholder}>搜任意西语视频…</Text>
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
              router.push({ pathname: "/watch/[videoId]", params: { videoId: id } } as never);
            }}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.cardPressed]}
          >
            <Text style={styles.linkBtnText}>打开</Text>
          </Pressable>
        </View>

        {!loading && featuredVideo ? (
          <View style={styles.discoveryCard}>
            <Text style={styles.discoveryEyebrow}>随机挑一集</Text>
            <Text numberOfLines={2} style={styles.discoveryTitle}>
              {featuredVideo.title}
            </Text>
            <Text style={styles.discoveryMeta}>
              {featuredVideo.channelTitle} · {formatDuration(featuredVideo.duration)}
            </Text>
            <View style={styles.discoveryActions}>
              <Pressable
                onPress={() => setShuffleSeed((s) => s + 1)}
                style={({ pressed }) => [styles.shuffleBtn, pressed && styles.cardPressed]}
              >
                <Text style={styles.shuffleBtnText}>换一批排列</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/watch/[videoId]",
                    params: {
                      videoId: featuredVideo.id,
                      title: featuredVideo.title,
                      channelTitle: featuredVideo.channelTitle,
                      thumbnail: featuredVideo.thumbnail
                    }
                  } as never)
                }
                style={({ pressed }) => [styles.playNowBtn, pressed && styles.cardPressed]}
              >
                <Text style={styles.playNowBtnText}>立即观看 →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!loading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {levels.map((level) => {
              const active = selectedLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setSelectedLevel(level)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.loadingText}>正在取视频列表…</Text>
          </View>
        ) : (
          visibleChannels.map((channel) => {
            const freshness = getFreshnessLabel(channel.videos);
            return (
            <View key={channel.id} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.channelTitle}>{channel.title}</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{channel.level}</Text>
                  </View>
                  {freshness ? (
                    <View style={styles.freshBadge}>
                      <Text style={styles.freshBadgeText}>{freshness}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.channelHint}>{channel.hint}</Text>
              </View>

              {channel.error ? (
                <Text style={styles.sectionError}>{channel.error}</Text>
              ) : (
                channel.videos.map((video) => {
                  const saved = progress[video.id];
                  const resumable = shouldResume(saved);
                  const pct =
                    resumable && saved && saved.duration > 0
                      ? Math.min(100, (saved.position / saved.duration) * 100)
                      : 0;

                  return (
                    <Pressable
                      key={video.id}
                      onPress={() =>
                        // typedRoutes 的类型在首次 `expo start` 后才生成,这里先绕过
                        router.push({
                          pathname: "/watch/[videoId]",
                          params: {
                            videoId: video.id,
                            title: video.title,
                            channelTitle: video.channelTitle,
                            thumbnail: video.thumbnail
                          }
                        } as never)
                      }
                      style={({ pressed }) => [
                        styles.card,
                        pressed && styles.cardPressed
                      ]}
                    >
                      <View style={styles.thumbWrap}>
                        <Image
                          source={{ uri: video.thumbnail }}
                          style={styles.thumb}
                          // 缩略图来自 i.ytimg.com,加载失败时留一块底色而不是破图
                        />
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>
                            {formatDuration(video.duration)}
                          </Text>
                        </View>

                        {/* 看了一半的标记:和首页「接着看」用同一套 shouldResume 判定 */}
                        {resumable && saved ? (
                          <>
                            <View style={styles.resumeBadge}>
                              <Text style={styles.resumeText}>
                                看到 {formatPosition(saved.position)}
                              </Text>
                            </View>
                            <View style={styles.progressTrack}>
                              <View
                                style={[styles.progressFill, { width: `${Math.max(3, pct)}%` }]}
                              />
                            </View>
                          </>
                        ) : null}
                      </View>

                      <View style={styles.cardBody}>
                        <Text numberOfLines={2} style={styles.videoTitle}>
                          {video.title}
                        </Text>
                        <Text style={styles.videoMeta}>{video.channelTitle}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
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
  subtitle: {
    marginTop: spacing.xs + 2,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary
  },
  searchBar: {
    marginTop: spacing.md + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14
  },
  searchPlaceholder: { fontSize: 13, color: colors.textTertiary },
  linkRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  linkInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 12.5,
    color: colors.text
  },
  linkBtn: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  linkBtnText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  discoveryCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.md,
    gap: 6
  },
  discoveryEyebrow: { fontSize: 11, fontWeight: "700", color: colors.brand600 },
  discoveryTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21, color: colors.text },
  discoveryMeta: { fontSize: 11.5, color: colors.textSecondary },
  discoveryActions: { marginTop: 6, flexDirection: "row", gap: 8 },
  shuffleBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  shuffleBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  playNowBtn: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  playNowBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  filterRow: { marginTop: spacing.md, gap: 8, paddingVertical: 2 },
  filterPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  filterPillActive: { borderColor: colors.brand500, backgroundColor: colors.brand500 },
  filterPillText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  filterPillTextActive: { color: "#fff" },
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
    gap: spacing.md
  },
  loadingText: { fontSize: 12.5, color: colors.textTertiary },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionHead: { gap: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  levelBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  levelBadgeText: { fontSize: 10.5, fontWeight: "700", color: colors.brand600 },
  freshBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  freshBadgeText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  channelTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  channelHint: { fontSize: 12, color: colors.textTertiary },
  sectionError: { fontSize: 12.5, color: colors.danger },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  thumbWrap: { position: "relative" },
  thumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceMuted
  },
  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.72)"
  },
  durationText: { fontSize: 10.5, fontWeight: "700", color: "#fff" },
  resumeBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.72)"
  },
  resumeText: { fontSize: 10.5, fontWeight: "700", color: "#fff" },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)"
  },
  progressFill: { height: "100%", backgroundColor: colors.brand500 },
  cardBody: { padding: spacing.md, gap: 4 },
  videoTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.text
  },
  videoMeta: { fontSize: 11.5, color: colors.textSecondary }
});
