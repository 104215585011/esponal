// Timestamp: 2026-11-16 09:15
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Slider from "@react-native-community/slider";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";

import { getProxiedCoverUrl } from "@/api/podcasts";
import { formatClock } from "@/api/watch";
import { useBackgroundMedia } from "@/context/BackgroundMediaContext";
import { colors, radius } from "@/theme";

const TAB_ROUTES = new Set(["/", "/index", "/watch", "/lectura", "/review", "/me"]);

function formatPodcastClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * 根级持久媒体宿主（播客 Mini-Bar + 视频持久 WebView / 悬浮 PiP 小窗）。
 * 挂载在 Root `<Stack>` 之外，保证用户切换页面或熄屏/切后台时播放不中断。
 */
export function GlobalMediaHost() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: winHeight } = useWindowDimensions();

  const {
    activePodcast,
    podcastStatus,
    openPodcast,
    togglePodcastPlay,
    jumpPodcastBy,
    closePodcast,

    activeVideo,
    videoPlaying,
    videoRate,
    videoFullscreen,
    videoCurrentTime,
    videoDuration,
    videoError,
    videoPlayerRef,
    seekingVideoRef,
    watchOverlay,
    setVideoPlaying,
    setVideoCurrentTime,
    setVideoError,
    seekVideoTo,
    probeVideoDuration,
    closeVideo
  } = useBackgroundMedia();

  const isWatchRoute = pathname.startsWith("/watch/");
  const isPodcastRoute = pathname.startsWith("/listening/podcast");
  const isTabRoute = TAB_ROUTES.has(pathname);

  const showPodcastBar = Boolean(activePodcast) && !isPodcastRoute;
  const showVideoStage = Boolean(activeVideo) && isWatchRoute;
  const showVideoPip = Boolean(activeVideo) && !isWatchRoute;

  const baseBottom = (isTabRoute ? 68 : 12) + Math.max(insets.bottom, 6);
  const pipBottom = showPodcastBar ? baseBottom + 76 : baseBottom;

  const videoHeight = Math.round((width * 9) / 16);
  const fsFit = useMemo(() => {
    if (width / Math.max(winHeight, 1) > 16 / 9) {
      const h = winHeight;
      return { w: Math.round((h * 16) / 9), h };
    }
    return { w: width, h: Math.round((width * 9) / 16) };
  }, [width, winHeight]);

  const pipW = 164;
  const pipVideoH = 92;

  const podCurrent = podcastStatus.currentTime || 0;
  const podDuration =
    podcastStatus.duration > 0 ? podcastStatus.duration : activePodcast?.durationSec ?? 0;
  const podProgress = podDuration > 0 ? Math.min(1, Math.max(0, podCurrent / podDuration)) : 0;
  const podCoverProxied = activePodcast?.coverUrl
    ? getProxiedCoverUrl(activePodcast.coverUrl) ?? activePodcast.coverUrl
    : null;

  const returnToVideoScreen = () => {
    if (!activeVideo) return;
    router.push({
      pathname: "/watch/[videoId]",
      params: {
        videoId: activeVideo.videoId,
        title: activeVideo.title,
        channelTitle: activeVideo.channelTitle ?? "",
        thumbnail: activeVideo.thumbnail ?? ""
      }
    } as never);
  };

  const openPodcastScreen = () => {
    if (!activePodcast) return;
    openPodcast(activePodcast);
    router.push({
      pathname: "/listening/podcast",
      params: {
        id: activePodcast.id ?? "",
        title: activePodcast.title,
        showTitle: activePodcast.showTitle,
        level: activePodcast.level ?? "A2-B1",
        audioUrl: activePodcast.rawAudioUrl,
        description: activePodcast.description ?? "",
        durationSec: activePodcast.durationSec ? String(activePodcast.durationSec) : "",
        coverUrl: activePodcast.coverUrl ?? ""
      }
    } as never);
  };

  const fsSliderMax = videoDuration > 0 ? videoDuration : 1;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* ==================== 1. 持久视频播放器（全尺寸舞台 / 悬浮 PiP） ==================== */}
      {activeVideo ? (
        <View
          style={
            showVideoStage
              ? [
                  styles.videoStage,
                  { width, height: videoFullscreen ? winHeight : videoHeight },
                  videoFullscreen ? styles.videoStageFullscreen : null
                ]
              : [styles.videoPipCard, { width: pipW, bottom: pipBottom }]
          }
        >
          <View
            style={
              showVideoStage
                ? {
                    width: videoFullscreen ? fsFit.w : width,
                    height: videoFullscreen ? fsFit.h : videoHeight,
                    backgroundColor: "#000"
                  }
                : { width: pipW, height: pipVideoH, backgroundColor: "#000" }
            }
          >
            <YoutubePlayer
              baseUrlOverride="https://www.pcmuz.cn"
              forceAndroidAutoplay
              height={showVideoStage ? (videoFullscreen ? fsFit.h : videoHeight) : pipVideoH}
              initialPlayerParams={{
                controls: false,
                modestbranding: true,
                rel: false,
                preventFullScreen: false
              }}
              onChangeState={(state: string) => {
                if (state === "playing") {
                  setVideoPlaying(true);
                  void probeVideoDuration();
                }
                if (state === "paused" || state === "ended") {
                  setVideoPlaying(false);
                }
              }}
              onError={(err: string) => {
                setVideoError(err);
              }}
              onReady={() => {
                void probeVideoDuration();
              }}
              play={videoPlaying}
              playbackRate={videoRate}
              ref={videoPlayerRef}
              useLocalHTML
              videoId={activeVideo.videoId}
              width={showVideoStage ? (videoFullscreen ? fsFit.w : width) : pipW}
            />

            {showVideoStage ? (
              <Pressable
                onPress={() =>
                  watchOverlay ? watchOverlay.onTogglePlay() : setVideoPlaying((p) => !p)
                }
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Pressable onPress={returnToVideoScreen} style={StyleSheet.absoluteFill}>
                <View style={styles.pipExpandPill}>
                  <Text style={styles.pipExpandText}>展开</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* 详情页顶部/全屏控制浮层 */}
          {showVideoStage && watchOverlay ? (
            videoFullscreen ? (
              <>
                {watchOverlay.captionEs ? (
                  <View pointerEvents="none" style={styles.fsCaptionBox}>
                    <Text style={styles.fsCaptionEs}>{watchOverlay.captionEs}</Text>
                    {watchOverlay.captionZh ? (
                      <Text style={styles.fsCaptionZh}>{watchOverlay.captionZh}</Text>
                    ) : null}
                  </View>
                ) : null}

                <Pressable
                  onPress={watchOverlay.onExitFullscreen}
                  style={[styles.fsExitButton, { top: insets.top + 8, right: 16 }]}
                >
                  <Text style={styles.fsExitText}>✕ 退出全屏</Text>
                </Pressable>

                {videoError ? (
                  <Text style={[styles.fsErrorText, { top: insets.top + 12, left: 16 }]}>
                    播放器错误:{videoError}
                  </Text>
                ) : null}

                <View style={[styles.fsBottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                  <Text style={styles.fsTimeText}>{formatClock(videoCurrentTime)}</Text>
                  <Slider
                    maximumTrackTintColor="rgba(255,255,255,0.3)"
                    maximumValue={fsSliderMax}
                    minimumTrackTintColor={colors.brand500}
                    minimumValue={0}
                    onSlidingComplete={(value) => {
                      seekingVideoRef.current = false;
                      watchOverlay.onSeek(value);
                    }}
                    onSlidingStart={() => {
                      seekingVideoRef.current = true;
                    }}
                    onValueChange={(value) => {
                      setVideoCurrentTime(value);
                    }}
                    step={0}
                    style={styles.fsSlider}
                    thumbTintColor={colors.brand500}
                    value={fsSliderMax > 0 ? Math.min(videoCurrentTime, fsSliderMax) : 0}
                  />
                  <Text style={styles.fsTimeText}>{formatClock(videoDuration)}</Text>
                  <Pressable onPress={watchOverlay.onTogglePlay} style={styles.fsPlayButton}>
                    <Text style={styles.fsPlayIcon}>{videoPlaying ? "⏸" : "▶"}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  onPress={watchOverlay.onBack}
                  style={[styles.backButton, { top: insets.top + 8 }]}
                >
                  <Text style={styles.backIcon}>‹</Text>
                </Pressable>

                <Pressable
                  onPress={watchOverlay.onEnterFullscreen}
                  style={[styles.fsEnterButton, { top: insets.top + 8, right: 12 }]}
                >
                  <Text style={styles.fsEnterIcon}>⛶</Text>
                </Pressable>

                <Pressable
                  disabled={watchOverlay.downloadRunning}
                  onPress={watchOverlay.onDownloadSubtitles}
                  style={[styles.fsEnterButton, { top: insets.top + 52, right: 12 }]}
                >
                  <Text style={styles.fsEnterIcon}>
                    {watchOverlay.downloadRunning ? "…" : "⬇"}
                  </Text>
                </Pressable>
              </>
            )
          ) : null}

          {/* 悬浮 PiP 底部控制条 */}
          {showVideoPip ? (
            <View style={styles.pipFooter}>
              <Pressable onPress={returnToVideoScreen} style={styles.pipTitleWrap}>
                <Text numberOfLines={1} style={styles.pipTitle}>
                  {activeVideo.title}
                </Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  setVideoPlaying((p) => !p);
                  if (!videoPlaying && videoCurrentTime > 0) {
                    seekVideoTo(videoCurrentTime);
                  }
                }}
                style={styles.pipIconBtn}
              >
                <Text style={styles.pipIconText}>{videoPlaying ? "⏸" : "▶"}</Text>
              </Pressable>
              <Pressable hitSlop={6} onPress={closeVideo} style={styles.pipIconBtn}>
                <Text style={styles.pipIconText}>✕</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ==================== 2. 播客悬浮后台 Mini-Bar ==================== */}
      {showPodcastBar && activePodcast ? (
        <View style={[styles.podcastBarWrap, { bottom: baseBottom }]}>
          <Pressable onPress={openPodcastScreen} style={styles.podcastBarMain}>
            {podCoverProxied ? (
              <Image source={{ uri: podCoverProxied }} style={styles.podCover} />
            ) : (
              <View style={styles.podCoverFallback}>
                <Text style={styles.podCoverIcon}>🎧</Text>
              </View>
            )}
            <View style={styles.podTextCol}>
              <Text numberOfLines={1} style={styles.podTitle}>
                {activePodcast.title}
              </Text>
              <Text numberOfLines={1} style={styles.podMeta}>
                {podcastStatus.playing ? "● 后台播 · " : "已暂停 · "}
                {activePodcast.showTitle} · {formatPodcastClock(podCurrent)}
                {podDuration > 0 ? ` / ${formatPodcastClock(podDuration)}` : ""}
              </Text>
            </View>
          </Pressable>

          <View style={styles.podActions}>
            <Pressable hitSlop={6} onPress={() => jumpPodcastBy(-15)} style={styles.podSeekBtn}>
              <Text style={styles.podSeekText}>-15s</Text>
            </Pressable>
            <Pressable hitSlop={4} onPress={togglePodcastPlay} style={styles.podPlayBtn}>
              <Text style={styles.podPlayIcon}>{podcastStatus.playing ? "⏸" : "▶"}</Text>
            </Pressable>
            <Pressable hitSlop={6} onPress={closePodcast} style={styles.podCloseBtn}>
              <Text style={styles.podCloseText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.podProgressTrack}>
            <View style={[styles.podProgressFill, { width: `${Math.round(podProgress * 100)}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  videoStage: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#000",
    zIndex: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  videoStageFullscreen: {
    right: 0,
    bottom: 0,
    zIndex: 50
  },
  videoPipCard: {
    position: "absolute",
    right: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    zIndex: 45
  },
  pipExpandPill: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(15,23,42,0.72)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  pipExpandText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#F8FAFC"
  },
  pipFooter: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 6,
    backgroundColor: "#0F172A"
  },
  pipTitleWrap: {
    flex: 1
  },
  pipTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0"
  },
  pipIconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  pipIconText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF"
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
    zIndex: 35
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
    zIndex: 35
  },
  fsEnterIcon: {
    fontSize: 16,
    color: "#fff",
    marginTop: 1
  },
  fsExitButton: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 55
  },
  fsExitText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#fff"
  },
  fsErrorText: {
    position: "absolute",
    fontSize: 12,
    color: "#FCA5A5",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 55
  },
  fsCaptionBox: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 62,
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.62)",
    zIndex: 52
  },
  fsCaptionEs: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center"
  },
  fsCaptionZh: {
    fontSize: 13.5,
    color: "#E2E8F0",
    textAlign: "center"
  },
  fsBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 55
  },
  fsTimeText: {
    fontSize: 11.5,
    color: "#E2E8F0",
    fontVariant: ["tabular-nums"]
  },
  fsSlider: {
    flex: 1,
    height: 30
  },
  fsPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  fsPlayIcon: {
    fontSize: 14,
    color: "#fff"
  },

  podcastBarWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 40
  },
  podcastBarMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 8
  },
  podCover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1E293B"
  },
  podCoverFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center"
  },
  podCoverIcon: {
    fontSize: 20
  },
  podTextCol: {
    flex: 1,
    gap: 2
  },
  podTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#F8FAFC"
  },
  podMeta: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8"
  },
  podActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  podSeekBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#1E293B"
  },
  podSeekText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1"
  },
  podPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  podPlayIcon: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  podCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  podCloseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8"
  },
  podProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2.5,
    backgroundColor: "#1E293B"
  },
  podProgressFill: {
    height: 2.5,
    backgroundColor: colors.brand500
  }
});
