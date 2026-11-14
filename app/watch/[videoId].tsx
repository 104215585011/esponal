// Timestamp: 2026-11-14 12:00
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Slider from "@react-native-community/slider";
import * as ScreenOrientation from "expo-screen-orientation";
import YoutubePlayer, { type YoutubeIframeRef } from "react-native-youtube-iframe";

import { fetchSubtitles, formatClock, translateText, type Cue } from "@/api/watch";
import { reportWatchHistory } from "@/api/stats";
import {
  getDownloadJob,
  startSubtitleDownload,
  subscribeDownloadJob,
  type DownloadJobState
} from "@/subtitles/subtitleDownload";
import { LookupSheet } from "@/components/LookupSheet";
import { TranscriptRow } from "@/components/TranscriptRow";
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
  const { width, height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

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
  /** 单句循环:当前字幕句播完自动跳回句首(学语言刚需) */
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  /** 字幕下载任务状态(模块级,离开页面任务也不中断) */
  const [downloadJob, setDownloadJob] = useState<DownloadJobState>(getDownloadJob());
  /** YouTube 播放器自身报错(153/101/150 等),直接展示省得猜 */
  const [playerError, setPlayerError] = useState<string | null>(null);
  /** 倍速:精听时放慢,泛听时加速(YouTube iframe 原生支持,不改音调) */
  const [rate, setRate] = useState(1);

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

  // 全屏 16:9 适配:以屏幕短边为限,等比缩放居中,多余部分留黑边。
  // 不能直接铺满 —— 手机横屏普遍是 20:9,直接满屏会裁掉视频底部并把控制条挤出屏幕。
  const fsFit = useMemo(() => {
    if (width / winHeight > 16 / 9) {
      const h = winHeight;
      return { w: Math.round((h * 16) / 9), h };
    }
    return { w: width, h: Math.round((width * 9) / 16) };
  }, [width, winHeight]);

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

  // 轮询播放进度:驱动当前句高亮 + 进度条 + 单句循环
  useEffect(() => {
    const timer = setInterval(async () => {
      // 用户正在拖进度条时不要被轮询覆盖
      if (seekingRef.current) return;

      try {
        const t = await playerRef.current?.getCurrentTime();
        if (typeof t === "number" && Number.isFinite(t)) {
          setCurrentTime(t);

          // 单句循环:播完当前字幕句就跳回句首
          if (loop && cues.length > 0) {
            let idx = -1;
            for (let i = cues.length - 1; i >= 0; i -= 1) {
              if (t + 0.15 >= cues[i].start) {
                idx = i;
                break;
              }
            }
            if (idx >= 0) {
              const cue = cues[idx];
              if (t >= cue.start + cue.dur - 0.05) {
                playerRef.current?.seekTo(cue.start, true);
                setCurrentTime(cue.start);
              }
            }
          }
        }
      } catch {
        // 播放器未就绪时忽略
      }
    }, 400);

    return () => clearInterval(timer);
  }, [loop, cues]);

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

  // 横屏全屏
  const enterFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {
      // 锁失败就不进全屏,避免竖屏铺满的诡异布局
      return;
    }
    setFullscreen(true);
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      // ignore
    }
    setFullscreen(false);
  }, []);

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

  const fsSliderMax = totalDuration > 0 ? totalDuration : 1;

  return (
    <View style={styles.root}>
      {/* 视频区(唯一使用 WebView 的地方);全屏时该容器绝对定位铺满整屏,
          播放器按 16:9 适配后居中(多余留黑边) */}
      <View
        style={[
          styles.videoWrap,
          { height: videoHeight },
          fullscreen
            ? { ...styles.videoWrapFullscreen, height: winHeight }
            : null
        ]}
      >
        <YoutubePlayer
          height={fullscreen ? fsFit.h : videoHeight}
          // HTML 打进安装包,不再依赖 GitHub Pages(国内网络下那个域名经常加载失败,
          // 加载失败 = YT API 播放器初始化不了,所有控制全部失灵)
          useLocalHTML
          // YouTube 2025 起的嵌入校验(Error 153):本地 HTML 的 origin 是空,
          // 必须给 WebView 指定一个真实 HTTPS 域名当来源;Web 端在 pcmuz.cn 下嵌 YouTube 正常
          baseUrlOverride="https://www.pcmuz.cn"
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
          onError={(err: string) => {
            setPlayerError(err);
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
          playbackRate={rate}
          ref={playerRef}
          videoId={String(videoId)}
          width={fullscreen ? fsFit.w : width}
        />

        {/* 透明触摸层:拦截视频区的所有点击,播放/暂停只走我们自己的控制,
            防止 YouTube iframe 内部的"点击切换播放"和我们的状态打架 */}
        <Pressable
          onPress={() => setPlaying((prev) => !prev)}
          style={StyleSheet.absoluteFill}
        />

        {fullscreen ? (
          <>
            {/* 全屏字幕浮层:只在全屏时出现,退出/非全屏自动消失 */}
            {cues.length > 0 && activeIndex >= 0 ? (
              <View style={styles.fsCaptionBox} pointerEvents="none">
                <Text style={styles.fsCaptionEs}>{cues[activeIndex].text}</Text>
                {bilingual && translations[activeIndex] ? (
                  <Text style={styles.fsCaptionZh}>{translations[activeIndex]}</Text>
                ) : null}
              </View>
            ) : null}

            {/* 全屏右上角:退出 */}
            <Pressable
              onPress={() => void exitFullscreen()}
              style={[styles.fsExitButton, { top: insets.top + 8, right: 16 }]}
            >
              <Text style={styles.fsExitText}>✕ 退出全屏</Text>
            </Pressable>

            {playerError ? (
              <Text style={[styles.fsErrorText, { top: insets.top + 12, left: 16 }]}>
                播放器错误:{playerError}
              </Text>
            ) : null}

            {/* 全屏底部:半透明进度条 */}
            <View style={[styles.fsBottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <Text style={styles.fsTimeText}>{formatClock(currentTime)}</Text>
              <Slider
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                maximumValue={fsSliderMax}
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
                  setCurrentTime(value);
                }}
                step={0}
                style={styles.fsSlider}
                thumbTintColor={colors.brand500}
                value={fsSliderMax > 0 ? Math.min(currentTime, fsSliderMax) : 0}
              />
              <Text style={styles.fsTimeText}>{formatClock(totalDuration)}</Text>
              <Pressable onPress={() => setPlaying((prev) => !prev)} style={styles.fsPlayButton}>
                <Text style={styles.playIcon}>{playing ? "⏸" : "▶"}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { top: insets.top + 8 }]}
            >
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>

            {/* 竖屏右下角:进全屏 */}
            <Pressable
              onPress={() => void enterFullscreen()}
              style={[styles.fsEnterButton, { top: insets.top + 8, right: 12 }]}
            >
              <Text style={styles.fsEnterIcon}>⛶</Text>
            </Pressable>

            {/* 竖屏:下载字幕讲义(全量翻译后生成 PDF,进度显示在控制条上方) */}
            <Pressable
              onPress={handleDownloadSubtitles}
              disabled={downloadJob.running}
              style={[styles.fsEnterButton, { top: insets.top + 52, right: 12 }]}
            >
              <Text style={styles.fsEnterIcon}>{downloadJob.running ? "…" : "⬇"}</Text>
            </Pressable>
          </>
        )}
      </View>

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

          {/* 倍速循环切换 0.75 → 1 → 1.25 → 1.5 */}
          <Pressable
            onPress={() =>
              setRate((prev) => {
                const i = RATE_STEPS.indexOf(prev);
                return RATE_STEPS[(i + 1) % RATE_STEPS.length];
              })
            }
            style={[styles.followChip, rate !== 1 && styles.followChipOn]}
          >
            <Text style={[styles.followChipText, rate !== 1 && styles.followChipTextOn]}>
              {rate}x
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
