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
import Slider from "@react-native-community/slider";
import YoutubePlayer, { type YoutubeIframeRef } from "react-native-youtube-iframe";

import { fetchSubtitles, formatClock, translateText, type Cue } from "@/api/watch";
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

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekingRef = useRef(false);
  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>();
  const [follow, setFollow] = useState(true);

  // 字幕末尾时间 —— 播放器时长拿不到时的兜底(安卓上 getDuration 在首次播放前经常返回 0)
  const cueDuration = useMemo(() => {
    if (cues.length === 0) return 0;
    const last = cues[cues.length - 1];
    return last.start + last.dur + 2;
  }, [cues]);

  // 双语字幕:只翻译「当前句 ±2」的滑动窗口,文本级缓存避免重复请求(会花翻译额度)
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const translationCacheRef = useRef(new Map<string, string>());
  const translationsRef = useRef<Record<number, string>>({});
  const translatingRef = useRef(new Set<number>());
  const [bilingual, setBilingual] = useState(true);

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

  // 轮询播放进度:驱动当前句高亮 + 进度条
  useEffect(() => {
    const timer = setInterval(async () => {
      // 用户正在拖进度条时不要被轮询覆盖
      if (seekingRef.current) return;

      try {
        const t = await playerRef.current?.getCurrentTime();
        if (typeof t === "number" && Number.isFinite(t)) {
          setCurrentTime(t);
        }
      } catch {
        // 播放器未就绪时忽略
      }
    }, 400);

    return () => clearInterval(timer);
  }, []);

  // 总时长:优先用播放器真实时长;拿不到就退回字幕推算时长,保证进度条始终可用
  const totalDuration = duration > 0 ? duration : cueDuration;

  // 时长探测:playerReady / 开始播放时都会触发。安卓上首次播放前 getDuration 返回 0,
  // 所以播放开始后还要再探一次。
  const probeDuration = useCallback(async () => {
    try {
      const d = await playerRef.current?.getDuration();
      if (typeof d === "number" && d > 0) setDuration(d);
    } catch {
      // 播放器未就绪时忽略
    }
  }, []);

  /** 当前播到第几句 */
  const activeIndex = useMemo(() => {
    if (cues.length === 0) return -1;
    for (let i = cues.length - 1; i >= 0; i -= 1) {
      if (currentTime + 0.15 >= cues[i].start) return i;
    }
    return 0;
  }, [cues, currentTime]);

  // 双语字幕:预翻译当前句 ±2,串行执行避免触发翻译限流
  useEffect(() => {
    if (!bilingual || activeIndex < 0 || cues.length === 0) return;

    let cancelled = false;
    const start = Math.max(0, activeIndex - 2);
    const end = Math.min(cues.length - 1, activeIndex + 2);

    const run = async () => {
      for (let i = start; i <= end; i += 1) {
        if (cancelled) return;

        const text = cues[i]?.text?.trim();
        if (!text) continue;
        if (translationsRef.current[i] || translatingRef.current.has(i)) continue;

        const cached = translationCacheRef.current.get(text);
        if (cached) {
          translationsRef.current = { ...translationsRef.current, [i]: cached };
          setTranslations(translationsRef.current);
          continue;
        }

        translatingRef.current.add(i);
        const result = await translateText(text);
        translatingRef.current.delete(i);

        if (cancelled || !result) continue;

        translationCacheRef.current.set(text, result);
        translationsRef.current = { ...translationsRef.current, [i]: result };
        setTranslations(translationsRef.current);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, cues, bilingual]);

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
          // HTML 打进安装包,不再依赖 GitHub Pages(国内网络下那个域名经常加载失败,
          // 加载失败 = YT API 播放器初始化不了,所有控制全部失灵)
          useLocalHTML
          // Android WebView 默认拦程序化播放,换桌面 UA 才能让 playVideo()/pauseVideo() 稳定生效
          forceAndroidAutoplay
          initialPlayerParams={{
            controls: false,
            modestbranding: true,
            rel: false,
            preventFullScreen: false
          }}
          onReady={() => {
            void probeDuration();
          }}
          onChangeState={(state: string) => {
            if (state === "playing") {
              setPlaying(true);
              // 首次播放后元数据才可用,补探一次时长
              void probeDuration();
            }
            if (state === "paused" || state === "ended") setPlaying(false);
          }}
          play={playing}
          ref={playerRef}
          videoId={String(videoId)}
          width={width}
        />

        {/* 透明触摸层:拦截视频区的所有点击,播放/暂停只走我们自己的控制,
            防止 YouTube iframe 内部的"点击切换播放"和我们的状态打架 */}
        <Pressable
          onPress={() => setPlaying((prev) => !prev)}
          style={StyleSheet.absoluteFill}
        />

        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      </View>

      {/* 原生控制条:进度条 + 按钮行 */}
      <View style={styles.controlWrap}>
        <View style={styles.progressRow}>
          <Text style={styles.timeText}>{formatClock(currentTime)}</Text>
          <Slider
            maximumTrackTintColor={colors.border}
            maximumValue={totalDuration > 0 ? totalDuration : 1}
            minimumTrackTintColor={colors.brand500}
            minimumValue={0}
            onSlidingComplete={(value) => {
              seekingRef.current = false;
              seekTo(value);
            }}
            onSlidingStart={() => {
              seekingRef.current = true;
            }}
            onValueChange={(value) => {
              // 拖动时先更新显示,松手才真正 seek
              setCurrentTime(value);
            }}
            step={0}
            style={styles.slider}
            thumbTintColor={colors.brand500}
            value={totalDuration > 0 ? Math.min(currentTime, totalDuration) : 0}
          />
          <Text style={styles.timeTextRight}>{formatClock(totalDuration)}</Text>
        </View>

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
            {title ? (
              <Text numberOfLines={1} style={styles.titleText}>
                {title}
              </Text>
            ) : null}
          </View>

        <Pressable
          onPress={() => setBilingual((prev) => !prev)}
          style={[styles.followChip, bilingual && styles.followChipOn]}
        >
          <Text style={[styles.followChipText, bilingual && styles.followChipTextOn]}>
            中文
          </Text>
        </Pressable>

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
              translation={bilingual ? translations[index] : null}
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
  controlWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  slider: {
    flex: 1,
    height: 32
  },
  timeTextRight: {
    minWidth: 38,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.textTertiary,
    textAlign: "right"
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: 0
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
