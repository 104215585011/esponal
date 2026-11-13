// Timestamp: 2026-11-13 17:55
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import YoutubePlayer, { type YoutubeIframeRef } from "react-native-youtube-iframe";

import { fetchSubtitles, formatClock, type Cue } from "@/api/watch";
import { LookupSheet } from "@/components/LookupSheet";
import { TranscriptRow } from "@/components/TranscriptRow";
import { colors, radius, spacing } from "@/theme";

/**
 * 播放页。
 *
 * 视频画面:YouTube iframe —— 这是平台规则限制(官方不允许第三方拉流),
 *          任何 App 都绕不开。但只限这一块。
 * 其余全部原生:字幕列表、当前句高亮、点词查词、控制条。
 */
export default function WatchPlayerScreen() {
  const { videoId, title } = useLocalSearchParams<{ videoId: string; title?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const playerRef = useRef<YoutubeIframeRef>(null);
  const listRef = useRef<FlatList<Cue>>(null);

  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>();
  const [follow, setFollow] = useState(true);

  const videoHeight = Math.round((width * 9) / 16);

  // 字幕加载
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchSubtitles(String(videoId))
      .then((data) => {
        if (cancelled) return;
        setCues(data);
        if (data.length === 0) setError("这部视频还没有字幕");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "字幕加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // 轮询播放进度:驱动当前句高亮
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const t = await playerRef.current?.getCurrentTime();
        if (typeof t === "number" && Number.isFinite(t)) {
          setCurrentTime(t);
        }
      } catch {
        // 播放器未就绪时忽略
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  /** 当前播到第几句 */
  const activeIndex = useMemo(() => {
    if (cues.length === 0) return -1;
    for (let i = cues.length - 1; i >= 0; i -= 1) {
      if (currentTime + 0.15 >= cues[i].start) return i;
    }
    return 0;
  }, [cues, currentTime]);

  // 自动跟随:滚动到当前句(用户手动滚动后会暂停跟随)
  useEffect(() => {
    if (!follow || activeIndex < 0) return;
    const raf = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.35
      });
    }, 80);
    return () => clearTimeout(raf);
  }, [activeIndex, follow]);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
    setCurrentTime(seconds);
    setFollow(true);
  }, []);

  const stepCue = useCallback(
    (delta: number) => {
      if (cues.length === 0) return;
      const target = Math.min(Math.max(activeIndex + delta, 0), cues.length - 1);
      seekTo(cues[target].start);
    },
    [activeIndex, cues, seekTo]
  );

  const handleWordPress = useCallback(
    (word: string) => {
      setLookupWord(word);
      setLookupContext(cues[activeIndex]?.text);
    },
    [cues, activeIndex]
  );

  if (!videoId) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>缺少视频 ID</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* 视频区(唯一使用 WebView 的地方) */}
      <View style={[styles.videoWrap, { height: videoHeight }]}>
        <YoutubePlayer
          height={videoHeight}
          initialPlayerParams={{
            controls: false,
            modestbranding: true,
            rel: false,
            preventFullScreen: false
          }}
          onChangeState={(state: string) => {
            if (state === "playing") setPlaying(true);
            if (state === "paused" || state === "ended") setPlaying(false);
          }}
          play={playing}
          ref={playerRef}
          videoId={String(videoId)}
          width={width}
        />

        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      </View>

      {/* 原生控制条 */}
      <View style={styles.controlBar}>
        <Pressable onPress={() => stepCue(-1)} style={styles.stepButton} hitSlop={8}>
          <Text style={styles.stepIcon}>⏮</Text>
        </Pressable>

        <Pressable
          onPress={() => setPlaying((prev) => !prev)}
          style={styles.playButton}
        >
          <Text style={styles.playIcon}>{playing ? "⏸" : "▶"}</Text>
        </Pressable>

        <Pressable onPress={() => stepCue(1)} style={styles.stepButton} hitSlop={8}>
          <Text style={styles.stepIcon}>⏭</Text>
        </Pressable>

        <View style={styles.metaBox}>
          <Text style={styles.timeText}>{formatClock(currentTime)}</Text>
          {title ? (
            <Text numberOfLines={1} style={styles.titleText}>
              {title}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            setFollow(true);
            if (activeIndex >= 0) seekTo(cues[activeIndex].start);
          }}
          style={[styles.followChip, follow && styles.followChipOn]}
        >
          <Text style={[styles.followChipText, follow && styles.followChipTextOn]}>
            跟随
          </Text>
        </Pressable>
      </View>

      {/* 原生字幕列表 */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.hint}>正在取字幕…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.hint}>这部视频可能没有生成双语字幕</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={cues}
          initialNumToRender={14}
          keyExtractor={(item, index) => `${index}-${item.start}`}
          maxToRenderPerBatch={20}
          onScrollBeginDrag={() => setFollow(false)}
          ref={listRef}
          renderItem={({ item, index }) => (
            <TranscriptRow
              active={index === activeIndex}
              onPhrasePress={() => {
                setLookupWord(item.text.split(/\s+/)[0] ?? "");
                setLookupContext(item.text);
              }}
              onSeek={() => seekTo(item.start)}
              onWordPress={handleWordPress}
              text={item.text}
            />
          )}
          showsVerticalScrollIndicator={false}
          windowSize={9}
        />
      )}

      <LookupSheet
        context={lookupContext}
        onClose={() => setLookupWord(null)}
        word={lookupWord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg
  },
  videoWrap: {
    width: "100%",
    backgroundColor: "#000"
  },
  backButton: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  backIcon: {
    marginTop: -3,
    fontSize: 26,
    lineHeight: 30,
    color: "#fff",
    fontWeight: "300"
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  stepButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  stepIcon: { fontSize: 15, color: colors.textSecondary },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  playIcon: { fontSize: 16, color: "#fff" },
  metaBox: { flex: 1, paddingHorizontal: spacing.sm },
  timeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.brand700
  },
  titleText: { marginTop: 1, fontSize: 11.5, color: colors.textSecondary },
  followChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  followChipOn: { backgroundColor: colors.brand50 },
  followChipText: { fontSize: 10.5, fontWeight: "700", color: colors.textTertiary },
  followChipTextOn: { color: colors.brand700 },
  listContent: {
    paddingVertical: spacing.md,
    paddingBottom: 40
  },
  hint: { fontSize: 12.5, color: colors.textTertiary, textAlign: "center" },
  errorText: { fontSize: 14, color: colors.text, textAlign: "center" }
});
