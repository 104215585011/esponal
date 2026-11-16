// Timestamp: 2026-11-16 09:10
import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioStatus
} from "expo-audio";
import type { YoutubeIframeRef } from "react-native-youtube-iframe";

import { getProxiedCoverUrl } from "@/api/podcasts";
import { pushServerProgress } from "@/api/watchProgress";
import { getPreferences } from "@/lib/preferences";
import { saveWatchProgress } from "@/lib/watchProgress";

export interface ActivePodcastTrack {
  id?: string;
  title: string;
  showTitle: string;
  level?: string;
  rawAudioUrl: string;
  playbackUrl: string;
  description?: string;
  durationSec?: number;
  coverUrl?: string;
  link?: string;
}

export interface ActiveVideoTrack {
  videoId: string;
  title: string;
  channelTitle?: string;
  thumbnail?: string;
}

export interface WatchOverlayCallbacks {
  onBack: () => void;
  onTogglePlay: () => void;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onDownloadSubtitles: () => void;
  onSeek: (sec: number) => void;
  downloadRunning: boolean;
  captionEs?: string | null;
  captionZh?: string | null;
}

interface BackgroundMediaContextValue {
  // ---- Podcast (expo-audio, true OS background + lockscreen) ----
  activePodcast: ActivePodcastTrack | null;
  podcastStatus: AudioStatus;
  podcastRate: number;
  podcastLoopAnchor: number | null;
  podcastAudioError: string | null;
  openPodcast: (track: ActivePodcastTrack) => void;
  togglePodcastPlay: () => void;
  pausePodcast: () => void;
  seekPodcastTo: (sec: number) => void;
  jumpPodcastBy: (delta: number) => void;
  setPodcastRate: (rate: number) => void;
  togglePodcastLoop: () => void;
  clearPodcastLoop: () => void;
  retryPodcastAudio: () => void;
  closePodcast: () => void;

  // ---- Video (persistent WebView host + PiP mini-player) ----
  activeVideo: ActiveVideoTrack | null;
  videoPlaying: boolean;
  videoRate: number;
  videoBgEnabled: boolean;
  videoFullscreen: boolean;
  videoCurrentTime: number;
  videoDuration: number;
  videoError: string | null;
  videoPlayerRef: MutableRefObject<YoutubeIframeRef | null>;
  seekingVideoRef: MutableRefObject<boolean>;
  watchOverlay: WatchOverlayCallbacks | null;
  openVideo: (track: ActiveVideoTrack) => void;
  setVideoPlaying: (next: boolean | ((prev: boolean) => boolean)) => void;
  setVideoRate: (rate: number) => void;
  setVideoBgEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setVideoFullscreen: (fs: boolean) => void;
  setVideoCurrentTime: (t: number) => void;
  setVideoDuration: (d: number) => void;
  setVideoError: (err: string | null) => void;
  seekVideoTo: (sec: number) => void;
  probeVideoDuration: () => Promise<number | null>;
  setWatchOverlay: (cb: WatchOverlayCallbacks | null) => void;
  onWatchUnmount: () => void;
  closeVideo: () => void;
}

const BackgroundMediaContext = createContext<BackgroundMediaContextValue | null>(null);

export function BackgroundMediaProvider({ children }: { children: ReactNode }) {
  // ==================== PODCAST ====================
  const [activePodcast, setActivePodcast] = useState<ActivePodcastTrack | null>(null);
  const [podcastRate, setPodcastRate] = useState(1.0);
  const [podcastLoopAnchor, setPodcastLoopAnchor] = useState<number | null>(null);
  const [podcastAudioError, setPodcastAudioError] = useState<string | null>(null);
  const notifAskedRef = useRef(false);

  const podcastPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const podcastStatus = useAudioPlayerStatus(podcastPlayer);

  // ==================== VIDEO ====================
  const [activeVideo, setActiveVideo] = useState<ActiveVideoTrack | null>(null);
  const [videoPlaying, setVideoPlayingState] = useState(false);
  const [videoRate, setVideoRate] = useState(() => getPreferences().videoRate ?? 1);
  const [videoBgEnabled, setVideoBgEnabled] = useState(true);
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [watchOverlay, setWatchOverlay] = useState<WatchOverlayCallbacks | null>(null);

  const videoPlayerRef = useRef<YoutubeIframeRef | null>(null);
  const seekingVideoRef = useRef(false);
  const videoPlayingRef = useRef(false);
  const videoBgEnabledRef = useRef(true);
  const activeVideoRef = useRef<ActiveVideoTrack | null>(null);
  const videoDurationRef = useRef(0);
  const lastSavedVideoRef = useRef(0);
  const lastPushedVideoRef = useRef(0);

  videoPlayingRef.current = videoPlaying;
  videoBgEnabledRef.current = videoBgEnabled;
  activeVideoRef.current = activeVideo;
  videoDurationRef.current = videoDuration;

  const ensureNotificationPermissionOnce = useCallback(() => {
    if (notifAskedRef.current) return;
    notifAskedRef.current = true;
    void requestNotificationPermissionsAsync().catch(() => {});
  }, []);

  const syncLockScreen = useCallback(
    (track: ActivePodcastTrack | null) => {
      if (!track) {
        try {
          podcastPlayer.clearLockScreenControls();
        } catch {
          // ignore
        }
        return;
      }

      const artworkUrl = track.coverUrl
        ? getProxiedCoverUrl(track.coverUrl) ?? track.coverUrl
        : undefined;

      try {
        podcastPlayer.setActiveForLockScreen(
          true,
          {
            title: track.title,
            artist: track.showTitle,
            albumTitle: track.level ? `Esponal · ${track.level}` : "Esponal 播客精听",
            artworkUrl
          },
          {
            showSeekBackward: true,
            showSeekForward: true,
            seekBackwardIntervalSeconds: 15,
            seekForwardIntervalSeconds: 15
          }
        );
      } catch {
        // 某些模拟器/过渡态不支持时静默降级
      }
    },
    [podcastPlayer]
  );

  const pausePodcast = useCallback(() => {
    try {
      podcastPlayer.pause();
    } catch {
      // ignore
    }
  }, [podcastPlayer]);

  const setVideoPlaying = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setVideoPlayingState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved) {
          // 视频开始播时先暂停播客，避免 Android AudioFocus 互相打断
          try {
            if (podcastPlayer.playing) {
              podcastPlayer.pause();
            }
          } catch {
            // ignore
          }
        }
        return resolved;
      });
    },
    [podcastPlayer]
  );

  const openPodcast = useCallback(
    (track: ActivePodcastTrack) => {
      if (!track.playbackUrl) {
        setPodcastAudioError("该节目暂无可用音频地址");
        return;
      }
      setPodcastAudioError(null);
      ensureNotificationPermissionOnce();

      // 播客开播前先停掉视频，让 expo-audio doNotMix 音频焦点干净切换
      setVideoPlayingState(false);

      const isSameSource = activePodcast?.playbackUrl === track.playbackUrl;
      setActivePodcast(track);

      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix"
      }).catch(() => {});

      if (!isSameSource) {
        setPodcastLoopAnchor(null);
        try {
          podcastPlayer.replace({ uri: track.playbackUrl });
          podcastPlayer.play();
        } catch (e) {
          setPodcastAudioError(e instanceof Error ? e.message : "音频加载失败");
        }
      }

      syncLockScreen(track);
    },
    [activePodcast?.playbackUrl, ensureNotificationPermissionOnce, podcastPlayer, syncLockScreen]
  );

  // 音频加载完成后再绑定一次锁屏控件，确保 Android MediaSession 及时出现
  useEffect(() => {
    if (!activePodcast || !podcastStatus.isLoaded) return;
    syncLockScreen(activePodcast);
  }, [activePodcast, podcastStatus.isLoaded, syncLockScreen]);

  // 保持播客倍速
  useEffect(() => {
    if (!podcastStatus.isLoaded) return;
    try {
      podcastPlayer.setPlaybackRate(podcastRate, "medium");
    } catch {
      // ignore
    }
  }, [podcastStatus.isLoaded, podcastRate, podcastPlayer]);

  // 播客 30 秒片段循环（切后台/锁屏后同样持续有效）
  useEffect(() => {
    if (podcastLoopAnchor === null || !podcastStatus.playing) return;
    const t = podcastStatus.currentTime || 0;
    if (t >= podcastLoopAnchor + 30) {
      void podcastPlayer.seekTo(podcastLoopAnchor);
    }
  }, [podcastLoopAnchor, podcastStatus.currentTime, podcastStatus.playing, podcastPlayer]);

  const togglePodcastPlay = useCallback(() => {
    if (!activePodcast?.playbackUrl) {
      setPodcastAudioError("该节目暂无可用音频地址");
      return;
    }
    setPodcastAudioError(null);
    ensureNotificationPermissionOnce();

    try {
      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix"
      }).catch(() => {});

      if (podcastStatus.playing) {
        podcastPlayer.pause();
      } else {
        setVideoPlayingState(false);
        podcastPlayer.play();
        syncLockScreen(activePodcast);
      }
    } catch (e) {
      setPodcastAudioError(e instanceof Error ? e.message : "音频播放出错，请点重试");
    }
  }, [
    activePodcast,
    ensureNotificationPermissionOnce,
    podcastPlayer,
    podcastStatus.playing,
    syncLockScreen
  ]);

  const seekPodcastTo = useCallback(
    (sec: number) => {
      if (!activePodcast) return;
      const total = podcastStatus.duration > 0 ? podcastStatus.duration : activePodcast.durationSec ?? 3600;
      const clamped = Math.max(0, Math.min(total, sec));
      void podcastPlayer.seekTo(clamped);
    },
    [activePodcast, podcastPlayer, podcastStatus.duration]
  );

  const jumpPodcastBy = useCallback(
    (delta: number) => {
      const current = podcastStatus.currentTime || 0;
      seekPodcastTo(current + delta);
    },
    [podcastStatus.currentTime, seekPodcastTo]
  );

  const togglePodcastLoop = useCallback(() => {
    const current = podcastStatus.currentTime || 0;
    setPodcastLoopAnchor((prev) => (prev === null ? Math.max(0, Math.floor(current)) : null));
  }, [podcastStatus.currentTime]);

  const clearPodcastLoop = useCallback(() => {
    setPodcastLoopAnchor(null);
  }, []);

  const retryPodcastAudio = useCallback(() => {
    if (!activePodcast?.playbackUrl) return;
    setPodcastAudioError(null);
    ensureNotificationPermissionOnce();
    setVideoPlayingState(false);
    try {
      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix"
      }).catch(() => {});
      podcastPlayer.replace({ uri: activePodcast.playbackUrl });
      podcastPlayer.play();
      syncLockScreen(activePodcast);
    } catch (e) {
      setPodcastAudioError(e instanceof Error ? e.message : "重新加载音频失败");
    }
  }, [activePodcast, ensureNotificationPermissionOnce, podcastPlayer, syncLockScreen]);

  const closePodcast = useCallback(() => {
    try {
      podcastPlayer.pause();
      podcastPlayer.clearLockScreenControls();
    } catch {
      // ignore
    }
    setPodcastLoopAnchor(null);
    setPodcastAudioError(null);
    setActivePodcast(null);
  }, [podcastPlayer]);

  // ==================== VIDEO ====================
  const openVideo = useCallback(
    (track: ActiveVideoTrack) => {
      const sameVideo = activeVideoRef.current?.videoId === track.videoId;
      if (sameVideo) {
        // 同一部视频（例如从悬浮小窗回到详情页），保持当前进度与播放状态，只更新元信息
        setActiveVideo(track);
        return;
      }

      setVideoError(null);
      setVideoFullscreen(false);
      setVideoCurrentTime(0);
      setVideoDuration(0);
      lastSavedVideoRef.current = 0;
      lastPushedVideoRef.current = 0;
      setVideoPlayingState(false);
      setActiveVideo(track);
    },
    []
  );

  const seekVideoTo = useCallback((sec: number) => {
    const target = Math.max(0, sec);
    try {
      videoPlayerRef.current?.seekTo(target, true);
    } catch {
      // ignore
    }
    setVideoCurrentTime(target);
  }, []);

  const probeVideoDuration = useCallback(async () => {
    try {
      const d = await videoPlayerRef.current?.getDuration();
      if (typeof d === "number" && d > 0) {
        setVideoDuration(d);
        videoDurationRef.current = d;
        return d;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const closeVideo = useCallback(() => {
    setVideoPlayingState(false);
    setVideoFullscreen(false);
    setVideoError(null);
    setWatchOverlay(null);
    setActiveVideo(null);
  }, []);

  const onWatchUnmount = useCallback(() => {
    setWatchOverlay(null);
    // 只有当前正在播放且开启后台播时，才保留悬浮 PiP 播放；否则自动收起
    if (!(videoPlayingRef.current && videoBgEnabledRef.current)) {
      setVideoPlayingState(false);
      setVideoFullscreen(false);
      setActiveVideo(null);
    }
  }, []);

  // 全局视频进度轮询：无论在视频页还是悬浮 PiP 状态都能持续刷新时间与持久化续播进度
  // 加上 inFlight 互斥锁与暂停跳过，杜绝 WebView EventEmitter 监听堆积导致播到一半内存/桥接崩溃
  useEffect(() => {
    if (!activeVideo) return;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (seekingVideoRef.current || inFlight || !videoPlayingRef.current) return;
      inFlight = true;
      try {
        const t = await videoPlayerRef.current?.getCurrentTime();
        if (typeof t === "number" && Number.isFinite(t) && t > 0) {
          setVideoCurrentTime((prev) => (Math.abs(t - prev) >= 0.18 ? t : prev));
          const vid = activeVideoRef.current?.videoId;
          if (vid) {
            const now = Date.now();
            if (now - lastSavedVideoRef.current > 5000) {
              lastSavedVideoRef.current = now;
              void saveWatchProgress(vid, t, videoDurationRef.current);
            }
            if (now - lastPushedVideoRef.current > 15000) {
              lastPushedVideoRef.current = now;
              void pushServerProgress(vid, t, videoDurationRef.current);
            }
          }
        }
      } catch {
        // 播放器未就绪时忽略
      } finally {
        inFlight = false;
      }
    }, 450);

    return () => clearInterval(timer);
  }, [activeVideo]);

  // 尊重「后台播」开关：关闭后台播时切到后台自动暂停视频
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active" && activeVideoRef.current && !videoBgEnabledRef.current) {
        setVideoPlayingState(false);
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<BackgroundMediaContextValue>(
    () => ({
      activePodcast,
      podcastStatus,
      podcastRate,
      podcastLoopAnchor,
      podcastAudioError,
      openPodcast,
      togglePodcastPlay,
      pausePodcast,
      seekPodcastTo,
      jumpPodcastBy,
      setPodcastRate,
      togglePodcastLoop,
      clearPodcastLoop,
      retryPodcastAudio,
      closePodcast,

      activeVideo,
      videoPlaying,
      videoRate,
      videoBgEnabled,
      videoFullscreen,
      videoCurrentTime,
      videoDuration,
      videoError,
      videoPlayerRef,
      seekingVideoRef,
      watchOverlay,
      openVideo,
      setVideoPlaying,
      setVideoRate,
      setVideoBgEnabled,
      setVideoFullscreen,
      setVideoCurrentTime,
      setVideoDuration,
      setVideoError,
      seekVideoTo,
      probeVideoDuration,
      setWatchOverlay,
      onWatchUnmount,
      closeVideo
    }),
    [
      activePodcast,
      podcastStatus,
      podcastRate,
      podcastLoopAnchor,
      podcastAudioError,
      openPodcast,
      togglePodcastPlay,
      pausePodcast,
      seekPodcastTo,
      jumpPodcastBy,
      togglePodcastLoop,
      clearPodcastLoop,
      retryPodcastAudio,
      closePodcast,
      activeVideo,
      videoPlaying,
      videoRate,
      videoBgEnabled,
      videoFullscreen,
      videoCurrentTime,
      videoDuration,
      videoError,
      watchOverlay,
      openVideo,
      setVideoPlaying,
      seekVideoTo,
      probeVideoDuration,
      onWatchUnmount,
      closeVideo
    ]
  );

  return (
    <BackgroundMediaContext.Provider value={value}>{children}</BackgroundMediaContext.Provider>
  );
}

export function useBackgroundMedia() {
  const ctx = useContext(BackgroundMediaContext);
  if (!ctx) {
    throw new Error("useBackgroundMedia must be used within BackgroundMediaProvider");
  }
  return ctx;
}
