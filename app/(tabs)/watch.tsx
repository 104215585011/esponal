// Timestamp: 2026-11-13 18:00
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { curatedChannels, fetchChannelVideos, formatDuration, type VideoItem } from "@/api/watch";
import { colors, radius, spacing } from "@/theme";

type ChannelState = {
  id: string;
  title: string;
  hint: string;
  videos: VideoItem[];
  error: string | null;
};

export default function WatchScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelState[]>(
    curatedChannels.map((c) => ({ ...c, videos: [], error: null }))
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

        {/* 搜索入口:精选频道只有三个,想找别的内容用这里 */}
        <Pressable
          onPress={() => router.push("/search" as never)}
          style={({ pressed }) => [styles.searchBar, pressed && styles.cardPressed]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>搜任意西语视频…</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand500} />
            <Text style={styles.loadingText}>正在取视频列表…</Text>
          </View>
        ) : (
          channels.map((channel) => (
            <View key={channel.id} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.channelTitle}>{channel.title}</Text>
                <Text style={styles.channelHint}>{channel.hint}</Text>
              </View>

              {channel.error ? (
                <Text style={styles.sectionError}>{channel.error}</Text>
              ) : (
                channel.videos.map((video) => (
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
                    </View>

                    <View style={styles.cardBody}>
                      <Text numberOfLines={2} style={styles.videoTitle}>
                        {video.title}
                      </Text>
                      <Text style={styles.videoMeta}>{video.channelTitle}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary
  },
  searchBar: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14
  },
  searchIcon: { fontSize: 12.5 },
  searchPlaceholder: { fontSize: 13, color: colors.textTertiary },
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
    gap: spacing.md
  },
  loadingText: { fontSize: 12.5, color: colors.textTertiary },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionHead: { gap: 2 },
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
  cardBody: { padding: spacing.md, gap: 4 },
  videoTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.text
  },
  videoMeta: { fontSize: 11.5, color: colors.textSecondary }
});
