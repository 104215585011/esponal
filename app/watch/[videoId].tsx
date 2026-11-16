// Timestamp: 2026-11-16 09:25
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
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
import * as ScreenOrientation from "expo-screen-orientation";

import { fetchSubtitles, formatClock, translateText, type Cue } from "@/api/watch";
import { reportWatchHistory } from "@/api/stats";
import {
  getDownloadJob,
  startSubtitleDownload,
  subscribeDownloadJob,
  type DownloadJobState
} from "@/subtitles/subtitleDownload";
import { getPreferences, updatePreferences } from "@/lib/preferences";
import { LookupSheet } from "@/components/LookupSheet";
import { TranscriptRow } from "@/components/TranscriptRow";
import { useBackgroundMedia } from "@/context/BackgroundMediaContext";
import {
  adoptServerProgress,
  clearWatchProgress,
  formatPosition,
  getWatchProgress,
  loadWatchProgress,
  saveWatchProgress,
  shouldResume
} from "@/lib/watchProgress";
import { fetchServerProgress, pushServerProgress } from "@/api/watchProgress";
import { colors, radius, spacing } from "@/theme";

/**
 * 播放页。
 *
 * 视频画面:YouTube iframe —— 这是平台规则限制(官方不允许第三方拉流),
 *          任何 App 都绕不开。但只限这一块。
 * 其余全部原生:字幕列表、当前句高亮、点词查词、控制条、横屏全屏。
 *
 * 全屏实现:同一播放器实例不重挂,只切换外层容器为绝对定位铺满屏幕 +
 * 锁横屏(useWindowDimensions 随旋转自动更新宽高)。
 */
/** 倍速档位:点一下循环切换 */
const RATE_STEPS = [0.75, 1, 1.25, 1.5];

export default function WatchPlayerScreen() {
  const { videoId, title, channelTitle, thumbnail } = useLocalSearchParams<{
    videoId: string;
    title?: string;
    channelTitle?: string;
    thumbnail?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    activeVideo,
    videoPlaying: playing,
    videoRate: rate,
    videoBgEnabled: bgEnabled,
    videoFullscreen: fullscreen,
    videoCurrentTime: currentTime,
    videoDuration: duration,
    videoError: playerError,
    videoPlayerRef: playerRef,
    seekingVideoRef: seekingRef,
    openVideo,
    setVideoPlaying: setPlaying,
    setVideoRate: setRate,
    setVideoBgEnabled: setBgEnabled,
    setVideoFullscreen: setFullscreen,
    setVideoCurrentTime: setCurrentTime,
    seekVideoTo,
    probeVideoDuration,
    setWatchOverlay,
    onWatchUnmount
  } = useBackgroundMedia();

  const listRef = useRef<FlatList<Cue>>(null);

  const [cues, setCues] = useState<Cue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>();
  const [follow, setFollow] = useState(true);
  /** 单句循环:当前字幕句播完自动跳回句首(学语言刚需) */
  const [loop, setLoop] = useState(false);
  /** 字幕下载任务状态(模块级,离开页面任务也不中断) */
  const [downloadJob, setDownloadJob] = useState<DownloadJobState>(getDownloadJob());
  /**
   * 续播:进页面读一次本地进度,播放器就绪后跳过去。
   * resumedRef 防止 probeDuration 被调用多次时反复 seek(那会把用户拖回起点)。
   */
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const resumedRef = useRef(false);
  const [resumeNotice, setResumeNotice] = useState<number | null>(null);
  const currentTimeRef = useRef(0);
  const videoIdRef = useRef(String(videoId ?? ""));
  const durationRef = useRef(0);

  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  // 注册持久视频舞台（若从悬浮 PiP 回来同一视频，不会重新加载 WebView）
  useEffect(() => {
    if (!videoId) return;
    openVideo({
      videoId: String(videoId),
      title: title ? String(title) : "西语视频",
      channelTitle: channelTitle ? String(channelTitle) : undefined,
      thumbnail: thumbnail ? String(thumbnail) : undefined
    });
    void updatePreferences({ videoRate: getPreferences().videoRate ?? 1 });
  }, [videoId, title, channelTitle, thumbnail, openVideo]);

  useEffect(() => {
    return () => {
      onWatchUnmount();
    };
  }, [onWatchUnmount]);

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
  const totalDuration = duration > 0 ? duration : cueDuration;

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

  // 续播:先读本地（立刻可用）,再问服务端要一份（换设备时靠它把进度带过来）
  useEffect(() => {
    // 若是从悬浮 PiP 回到同一部正在播的视频，不要再跳回历史位置
    if (activeVideo?.videoId === String(videoId) && currentTimeRef.current > 2) {
      resumedRef.current = true;
      return;
    }

    let cancelled = false;
    resumedRef.current = false;
    setResumeAt(null);
    setResumeNotice(null);

    void (async () => {
      await loadWatchProgress();
      if (cancelled) return;

      const local = getWatchProgress(String(videoId));
      if (local && shouldResume(local)) setResumeAt(local.position);

      const server = await fetchServerProgress([String(videoId)]);
      if (cancelled) return;

      const remote = server[String(videoId)];
      if (remote && adoptServerProgress(String(videoId), remote.position, remote.duration)) {
        const merged = getWatchProgress(String(videoId));
        // 已经跳过的不要改位置,否则用户正在看会被拽走
        if (!resumedRef.current && merged && shouldResume(merged)) setResumeAt(merged.position);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId, activeVideo?.videoId]);

  /** 时长一到就跳到上次位置。只跳一次，resumedRef 挡住后续重复 seek */
  const applyResume = useCallback(async () => {
    if (resumedRef.current || resumeAt === null) return;

    try {
      const d = await playerRef.current?.getDuration();
      if (!(typeof d === "number" && d > 0)) return;

      if (resumeAt >= d * 0.92) {
        // 换设备/换版本后时长变了，原本的位置其实已经到片尾
        resumedRef.current = true;
        void clearWatchProgress(String(videoId));
        return;
      }

      resumedRef.current = true;
      await playerRef.current?.seekTo(resumeAt, true);
      setCurrentTime(resumeAt);
      currentTimeRef.current = resumeAt;
      setResumeNotice(resumeAt);
    } catch {
      // 播放器未就绪时忽略,下次 playing 还会再试
    }
  }, [resumeAt, videoId]);

  // 本地进度是异步读出来的，可能比 onReady 晚。位置一到就补一次跳转
  useEffect(() => {
    if (resumeAt === null) return;
    void applyResume();
  }, [resumeAt, applyResume]);

  // 提示条 8 秒后自动收起，别一直占着屏幕
  useEffect(() => {
    if (resumeNotice === null) return;
    const timer = setTimeout(() => setResumeNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [resumeNotice]);

  /** 从头开始:清掉进度并回到 0（"我看到一半但想重看" 是很常见的动作） */
  const restartFromBeginning = useCallback(() => {
    try {
      playerRef.current?.seekTo(0, true);
    } catch {
      // ignore
    }
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setResumeNotice(null);
    setResumeAt(null);
    resumedRef.current = true;
    void clearWatchProgress(String(videoId));
  }, [videoId]);

  // 离开页面时补存一次，避免最后 5 秒的进度丢掉
  useEffect(() => {
    videoIdRef.current = String(videoId ?? "");
    return () => {
      const t = currentTimeRef.current;
      if (t <= 1) return;
      void saveWatchProgress(videoIdRef.current, t, durationRef.current);
      void pushServerProgress(videoIdRef.current, t, durationRef.current);
    };
  }, [videoId]);

  // 当全局播放器探测到视频时长后，自动触发一次续播定位
  useEffect(() => {
    if (duration > 0) {
      void applyResume();
    }
  }, [duration, applyResume]);

  // 单句循环:播完当前字幕句就跳回句首
  useEffect(() => {
    if (!loop || !playing || cues.length === 0 || seekingRef.current) return;
    let idx = -1;
    for (let i = cues.length - 1; i >= 0; i -= 1) {
      if (currentTime + 0.15 >= cues[i].start) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) {
      const cue = cues[idx];
      if (currentTime >= cue.start + cue.dur - 0.05) {
        seekVideoTo(cue.start);
      }
    }
  }, [loop, playing, cues, currentTime, seekingRef, seekVideoTo]);

  // 横屏全屏
  const enterFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {
      // 锁失败就不进全屏,避免竖屏铺满的诡异布局
      return;
    }
    setFullscreen(true);
  }, [setFullscreen]);

  const exitFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      // ignore
    }
    setFullscreen(false);
  }, [setFullscreen]);

  // 离开页面时必须恢复竖屏,否则其他页面跟着横屏
  useEffect(() => {
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
        () => {}
      );
    };
  }, []);

  // 全屏时 Android 返回键先退全屏,不直接出页面
  useEffect(() => {
    if (!fullscreen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void exitFullscreen();
      return true;
    });
    return () => sub.remove();
  }, [fullscreen, exitFullscreen]);

  // 订阅下载任务状态
  useEffect(() => {
    return subscribeDownloadJob((state) => setDownloadJob(state));
  }, []);

  // 进入播放页静默上报观看历史(首页「最近观看」从这里来);缺频道信息就不报
  useEffect(() => {
    if (!videoId || !title || !channelTitle) return;
    void reportWatchHistory({
      videoId: String(videoId),
      title: String(title),
      channelTitle: String(channelTitle),
      thumbnail: thumbnail ? String(thumbnail) : null
    });
  }, [videoId, title, channelTitle, thumbnail]);

  const handleDownloadSubtitles = useCallback(() => {
    if (downloadJob.running || cues.length === 0 || !videoId) return;
    void startSubtitleDownload({
      videoId: String(videoId),
      title: title ?? "",
      cues,
      translations
    });
  }, [downloadJob.running, cues, videoId, title, translations]);

  /** 当前播放页对应的下载任务(进度条只显示自己的) */
  const thisJob = downloadJob.videoId === String(videoId) ? downloadJob : null;
  const dlPct =
    thisJob && thisJob.total > 0
      ? Math.round((thisJob.translated / thisJob.total) * 100)
      : 0;

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
  // 必须用 try/catch + onScrollToIndexFailed 兜底，防止播放到中后段未测量行触发 Invariant Violation 闪退
  useEffect(() => {
    if (!follow || activeIndex < 0 || activeIndex >= cues.length) return;
    const raf = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: activeIndex,
          animated: true,
          viewPosition: 0.35
        });
      } catch {
        // 未测量行由 onScrollToIndexFailed 或下次滚动兜底
      }
    }, 80);
    return () => clearTimeout(raf);
  }, [activeIndex, follow, cues.length]);

  const seekTo = useCallback(
    (seconds: number) => {
      seekVideoTo(seconds);
      setFollow(true);
    },
    [seekVideoTo]
  );

  // 把顶部控制 / 全屏 HUD 状态实时同步到根级 GlobalMediaHost，避免 WebView 被压在下方或重载
  useEffect(() => {
    setWatchOverlay({
      onBack: () => router.back(),
      onTogglePlay: () => setPlaying((prev) => !prev),
      onEnterFullscreen: () => void enterFullscreen(),
      onExitFullscreen: () => void exitFullscreen(),
      onDownloadSubtitles: handleDownloadSubtitles,
      onSeek: seekTo,
      downloadRunning: downloadJob.running,
      captionEs: cues[activeIndex]?.text ?? null,
      captionZh: bilingual ? (translations[activeIndex] ?? null) : null
    });
  }, [
    setWatchOverlay,
    router,
    setPlaying,
    enterFullscreen,
    exitFullscreen,
    handleDownloadSubtitles,
    seekTo,
    downloadJob.running,
    cues,
    activeIndex,
    bilingual,
    translations
  ]);

  const stepCue = useCallback(
    (delta: number) => {
      if (cues.length === 0) return;
      const target = Math.min(Math.max(activeIndex + delta, 0), cues.length - 1);
      seekTo(cues[target].start);
    },
    [activeIndex, cues, seekTo]
  );

  // 点词或点固定搭配查词时：先自动暂停视频，再打开查词面板
  const handleWordPress = useCallback(
    (word: string, sentence: string) => {
      setPlaying(false);
      setLookupWord(word);
      setLookupContext(sentence);
    },
    [setPlaying]
  );

  const handlePhrasePress = useCallback(
    (phraseLemma: string, sentence: string) => {
      setPlaying(false);
      setLookupWord(phraseLemma);
      setLookupContext(sentence);
    },
    [setPlaying]
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
      {/* 视频占位区：真正的 <YoutubePlayer> 挂在根级 GlobalMediaHost（支持切出悬浮小窗与后台/熄屏继续播） */}
      <View style={[styles.videoWrap, { height: videoHeight }]} />

      {/* 续播提示:明确告诉用户"不是从头开始",并给一个回到开头的出口 */}
      {resumeNotice !== null ? (
        <View style={styles.resumeBar}>
          <Text style={styles.resumeText}>
            已从 {formatPosition(resumeNotice)} 继续上次进度
          </Text>
          <Pressable hitSlop={8} onPress={restartFromBeginning}>
            <Text style={styles.resumeAction}>从头开始</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 原生控制条:进度条 + 按钮行 */}
      <View style={styles.controlWrap}>
        {/* 字幕下载进度(后台任务,离开页面也不中断) */}
        {thisJob?.running ? (
          <View style={styles.dlBanner}>
            <Text style={styles.dlText}>
              翻译字幕中 {thisJob.translated}/{thisJob.total}({dlPct}%)
            </Text>
            <View style={styles.dlTrack}>
              <View style={[styles.dlFill, { width: `${Math.max(3, dlPct)}%` }]} />
            </View>
          </View>
        ) : thisJob?.done && thisJob.entry ? (
          <Text style={styles.dlDone}>✓ 双语字幕讲义已保存,可在「我的-我的下载」打开</Text>
        ) : null}

        {playerError ? (
          <Text style={styles.playerErrorText}>播放器错误:{playerError}</Text>
        ) : null}
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
        </View>

        {/* 开关行:中文 / 跟随 / 循环 / 倍速(单独一行,避免挤标题) */}
        <View style={styles.chipBar}>
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

          <Pressable
            onPress={() => setLoop((prev) => !prev)}
            style={[styles.followChip, loop && styles.followChipOn]}
          >
            <Text style={[styles.followChipText, loop && styles.followChipTextOn]}>
              循环
            </Text>
          </Pressable>

          {/* 倍速循环切换 0.75 → 1 → 1.25 → 1.5,记住上次的选择 */}
          <Pressable
            onPress={() => {
              const i = RATE_STEPS.indexOf(rate);
              const next = RATE_STEPS[(i + 1) % RATE_STEPS.length];
              void updatePreferences({ videoRate: next });
              setRate(next);
            }}
            style={[styles.followChip, rate !== 1 && styles.followChipOn]}
          >
            <Text style={[styles.followChipText, rate !== 1 && styles.followChipTextOn]}>
              {rate}x
            </Text>
          </Pressable>

          {/* 后台播开关：默认开启，熄屏/切出维持音频或悬浮 PiP 小窗 */}
          <Pressable
            onPress={() => setBgEnabled((prev) => !prev)}
            style={[styles.followChip, bgEnabled && styles.followChipOn]}
          >
            <Text style={[styles.followChipText, bgEnabled && styles.followChipTextOn]}>
              后台播
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
          initialNumToRender={24}
          keyExtractor={(item, index) => `${index}-${item.start}`}
          maxToRenderPerBatch={24}
          onScrollBeginDrag={() => setFollow(false)}
          onScrollToIndexFailed={(info) => {
            const offset = Math.max(0, info.averageItemLength * info.index);
            listRef.current?.scrollToOffset({ offset, animated: true });
          }}
          ref={listRef}
          removeClippedSubviews={false}
          renderItem={({ item, index }) => (
            <TranscriptRow
              active={index === activeIndex}
              onPhrasePress={handlePhrasePress}
              onSeek={seekTo}
              onWordPress={handleWordPress}
              start={item.start}
              text={item.text}
              translation={bilingual ? translations[index] : null}
            />
          )}
          showsVerticalScrollIndicator={false}
          windowSize={15}
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
  videoWrapFullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000"
  },
  backButton: {
    position: "absolute",
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3
  },
  backIcon: {
    marginTop: -3,
    fontSize: 26,
    lineHeight: 30,
    color: "#fff",
    fontWeight: "300"
  },
  fsEnterButton: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3
  },
  fsEnterIcon: { fontSize: 16, color: "#fff", marginTop: 1 },
  fsExitButton: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 3
  },
  fsExitText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  fsErrorText: {
    position: "absolute",
    fontSize: 12,
    color: "#ff8a8a",
    zIndex: 3
  },
  fsBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 3
  },
  fsSlider: { flex: 1, height: 30 },
  fsTimeText: {
    minWidth: 38,
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center"
  },
  fsPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  fsCaptionBox: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 64,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 2
  },
  fsCaptionEs: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center"
  },
  fsCaptionZh: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center"
  },
  dlBanner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  resumeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.brand50
  },
  resumeText: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.brand700 },
  resumeAction: { fontSize: 12, fontWeight: "700", color: colors.brand600 },
  dlText: { fontSize: 11, fontWeight: "600", color: colors.brand700 },
  dlTrack: {
    marginTop: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  dlFill: { height: 4, backgroundColor: colors.brand500, borderRadius: 2 },
  dlDone: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    fontSize: 11.5,
    color: colors.brand700
  },
  controlWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  playerErrorText: {
    fontSize: 12,
    color: colors.danger,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
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
    paddingBottom: 4,
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
  chipBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: 2
  },
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
