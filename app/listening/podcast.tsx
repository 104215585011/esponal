// Timestamp: 2026-11-15 14:30
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Slider from "@react-native-community/slider";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchPodcastSubtitles,
  getProxiedPodcastAudioUrl,
  type PodcastCue
} from "@/api/podcasts";
import { LookupSheet } from "@/components/LookupSheet";
import { colors, radius, spacing } from "@/theme";

const RATES = [0.75, 0.9, 1.0, 1.2] as const;

type BottomTab = "subtitles" | "notes";

function formatClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function splitTokens(line: string) {
  return line.split(/(\s+)/);
}

function cleanWordToken(token: string) {
  return token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function mergeSortedCues(existing: PodcastCue[], incoming: PodcastCue[]): PodcastCue[] {
  const byKey = new Map<string, PodcastCue>();
  for (const cue of existing) {
    byKey.set(`${Math.round(cue.start)}:${cue.text.slice(0, 24)}`, cue);
  }
  for (const cue of incoming) {
    byKey.set(`${Math.round(cue.start)}:${cue.text.slice(0, 24)}`, cue);
  }
  return Array.from(byKey.values()).sort((a, b) => a.start - b.start);
}

/**
 * 播客精听播放器（对齐视频页体验）：
 * 顶部深色音频舞台（代理流播放 / ±15s / 进度拖拽 / 倍速 / 30s 片段循环），
 * 下方「双语字幕」与「全文简介」双 Tab，支持随播放高亮滚动与点词查变位。
 */
export default function PodcastPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    showTitle?: string;
    level?: string;
    audioUrl?: string;
    description?: string;
    durationSec?: string;
  }>();

  const title = typeof params.title === "string" ? params.title : "西语播客";
  const showTitle = typeof params.showTitle === "string" ? params.showTitle : "Podcast";
  const level = typeof params.level === "string" ? params.level : "B1";
  const rawAudioUrl = typeof params.audioUrl === "string" ? params.audioUrl : "";
  const description = typeof params.description === "string" ? params.description : "";
  const initialDurationSec = Number(params.durationSec) || 0;

  const playbackUrl = useMemo(() => getProxiedPodcastAudioUrl(rawAudioUrl), [rawAudioUrl]);
  const player = useAudioPlayer(playbackUrl ? { uri: playbackUrl } : null);
  const status = useAudioPlayerStatus(player);

  const [rate, setRate] = useState<number>(1.0);
  const [loopAnchor, setLoopAnchor] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<BottomTab>("subtitles");

  const [cues, setCues] = useState<PodcastCue[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | undefined>(undefined);

  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const cueYMap = useRef<Record<number, number>>({});
  const fetchedWindows = useRef<Set<number>>(new Set());

  const duration = status.duration || initialDurationSec || 0;
  const currentTime = status.currentTime || 0;

  // 确保播放模式走扬声器正常音量，不被之前语音对话录音模式影响
  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true
    }).catch(() => {});
  }, []);

  // 保持播放速度设置
  useEffect(() => {
    if (!status.isLoaded) return;
    try {
      player.setPlaybackRate(rate, "medium");
    } catch {
      // 忽略加载过渡期报错
    }
  }, [status.isLoaded, rate, player]);

  // 30 秒片段循环：播完 [anchor, anchor+30] 后自动拉回 anchor
  useEffect(() => {
    if (loopAnchor === null || !status.playing) return;
    if (currentTime >= loopAnchor + 30) {
      void player.seekTo(loopAnchor);
    }
  }, [loopAnchor, currentTime, status.playing, player]);

  const loadSubtitlesAt = useCallback(
    async (startSec: number, force = false) => {
      if (!rawAudioUrl) return;
      const alignedWindow = Math.floor(Math.max(0, startSec) / 50) * 50;
      if (!force && fetchedWindows.current.has(alignedWindow)) return;
      if (subLoading) return;

      fetchedWindows.current.add(alignedWindow);
      setSubLoading(true);
      setSubError(null);
      try {
        const res = await fetchPodcastSubtitles({
          audioUrl: rawAudioUrl,
          startSec: alignedWindow,
          durationSec: duration > 0 ? Math.round(duration) : undefined
        });
        if (res.cues && res.cues.length > 0) {
          setCues((prev) => mergeSortedCues(prev, res.cues));
        } else if (force) {
          setSubError("这一段未识别到有效语音，可拖到有人声的位置再生成一次。");
        }
      } catch (e) {
        fetchedWindows.current.delete(alignedWindow);
        setSubError(e instanceof Error ? e.message : "字幕生成失败，请稍后重试");
      } finally {
        setSubLoading(false);
      }
    },
    [rawAudioUrl, duration, subLoading]
  );

  // 首屏自动拉取开篇 0~55s 双语字幕，打开就能看
  useEffect(() => {
    if (!rawAudioUrl) return;
    fetchedWindows.current.clear();
    setCues([]);
    void loadSubtitlesAt(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAudioUrl]);

  // 当前播放高亮字幕索引
  const activeCueIndex = useMemo(() => {
    for (let i = cues.length - 1; i >= 0; i--) {
      if (currentTime >= cues[i].start - 0.35) return i;
    }
    return -1;
  }, [cues, currentTime]);

  useEffect(() => {
    if (activeTab !== "subtitles" || activeCueIndex < 0) return;
    const y = cueYMap.current[activeCueIndex];
    if (typeof y === "number") {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
    }
  }, [activeCueIndex, activeTab]);

  const togglePlay = useCallback(() => {
    setAudioError(null);
    if (!playbackUrl) {
      setAudioError("该节目暂无可用音频地址");
      return;
    }
    try {
      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true
      }).catch(() => {});
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "音频播放出错，请点重试");
    }
  }, [playbackUrl, status.playing, player]);

  const retryAudio = useCallback(() => {
    if (!playbackUrl) return;
    setAudioError(null);
    try {
      player.replace({ uri: playbackUrl });
      player.play();
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "重新加载音频失败");
    }
  }, [playbackUrl, player]);

  const jumpBy = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(duration || 3600, currentTime + delta));
      void player.seekTo(next);
    },
    [currentTime, duration, player]
  );

  const seekToCue = useCallback(
    (startSec: number) => {
      void player.seekTo(Math.max(0, startSec));
      if (!status.playing) {
        player.play();
      }
    },
    [player, status.playing]
  );

  const toggleLoop = useCallback(() => {
    setLoopAnchor((prev) => (prev === null ? Math.max(0, Math.floor(currentTime)) : null));
  }, [currentTime]);

  const noteParagraphs = useMemo(() => {
    if (!description) return [];
    return description
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [description]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {showTitle}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* 深色音频舞台：对齐视频页播放器结构 */}
      <View style={styles.stage}>
        <View style={styles.metaRow}>
          <Text style={styles.levelBadge}>{level}</Text>
          <Text numberOfLines={1} style={styles.showName}>
            {showTitle}
          </Text>
          <Text style={styles.statusChip}>
            {status.isBuffering && !status.playing
              ? "缓冲中…"
              : status.playing
                ? "正在播放"
                : status.isLoaded
                  ? "已就绪"
                  : rawAudioUrl
                    ? "正在连接音频"
                    : "无音频"}
          </Text>
        </View>

        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>

        <View style={styles.sliderWrap}>
          <Slider
            maximumTrackTintColor="rgba(255,255,255,0.22)"
            maximumValue={Math.max(1, duration)}
            minimumTrackTintColor={colors.brand500}
            minimumValue={0}
            onSlidingComplete={(val) => {
              void player.seekTo(val);
            }}
            thumbTintColor="#FFFFFF"
            value={Math.min(currentTime, Math.max(1, duration))}
          />
          <View style={styles.clockRow}>
            <Text style={styles.clock}>{formatClock(currentTime)}</Text>
            <Text style={styles.clock}>{duration > 0 ? formatClock(duration) : "--:--"}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable onPress={() => jumpBy(-15)} style={styles.jumpBtn}>
            <Text style={styles.jumpText}>-15s</Text>
          </Pressable>

          <Pressable onPress={togglePlay} style={styles.playBtn}>
            {status.isBuffering && !status.playing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.playText}>{status.playing ? "暂停" : "播放"}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => jumpBy(15)} style={styles.jumpBtn}>
            <Text style={styles.jumpText}>+15s</Text>
          </Pressable>
        </View>

        <View style={styles.toolsRow}>
          <View style={styles.rateRow}>
            {RATES.map((r) => {
              const active = rate === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRate(r)}
                  style={[styles.rateChip, active && styles.rateChipActive]}
                >
                  <Text style={[styles.rateText, active && styles.rateTextActive]}>{r}x</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={toggleLoop}
            style={[styles.loopBtn, loopAnchor !== null && styles.loopBtnActive]}
          >
            <Text style={[styles.loopText, loopAnchor !== null && styles.loopTextActive]}>
              {loopAnchor !== null
                ? `循环 ${formatClock(loopAnchor)}~${formatClock(loopAnchor + 30)}`
                : "30s 片段循环"}
            </Text>
          </Pressable>
        </View>

        {audioError ? (
          <View style={styles.audioErrorRow}>
            <Text style={styles.audioErrorText}>{audioError}</Text>
            <Pressable onPress={retryAudio} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>重试</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* 双 Tab：字幕精听 / 全文简介 */}
      <View style={styles.tabBar}>
        <Pressable
          onPress={() => setActiveTab("subtitles")}
          style={[styles.tabItem, activeTab === "subtitles" && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, activeTab === "subtitles" && styles.tabTextActive]}>
            字幕精听 {cues.length > 0 ? `(${cues.length})` : ""}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("notes")}
          style={[styles.tabItem, activeTab === "notes" && styles.tabItemActive]}
        >
          <Text style={[styles.tabText, activeTab === "notes" && styles.tabTextActive]}>
            全文简介
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "subtitles" ? (
          <>
            <View style={styles.subActionCard}>
              <View style={styles.subActionInfo}>
                <Text style={styles.subActionTitle}>AI 双语字幕（随播放进度按段生成）</Text>
                <Text style={styles.subActionHint}>
                  点任意时间跳转播放，点句子里的西语单词可直接查词与变位
                </Text>
              </View>
              <Pressable
                disabled={subLoading || !rawAudioUrl}
                onPress={() => void loadSubtitlesAt(currentTime, true)}
                style={[styles.genSubBtn, subLoading && styles.genSubBtnDisabled]}
              >
                {subLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.genSubBtnText}>
                    生成 {formatClock(Math.floor(currentTime / 50) * 50)} 起字幕
                  </Text>
                )}
              </Pressable>
            </View>

            {subError ? <Text style={styles.subError}>{subError}</Text> : null}

            {cues.length === 0 && !subLoading ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>当前片段还没有字幕</Text>
                <Text style={styles.emptyHint}>
                  点击上方“生成字幕”即可自动识别该段播客音频并配中文翻译。
                </Text>
              </View>
            ) : (
              cues.map((cue, idx) => {
                const active = idx === activeCueIndex;
                return (
                  <View
                    key={`${cue.start}-${idx}`}
                    onLayout={(e) => {
                      cueYMap.current[idx] = e.nativeEvent.layout.y;
                    }}
                    style={[styles.cueCard, active && styles.cueCardActive]}
                  >
                    <Pressable onPress={() => seekToCue(cue.start)} style={styles.cueHead}>
                      <Text style={[styles.cueTime, active && styles.cueTimeActive]}>
                        {formatClock(cue.start)}
                      </Text>
                      <Text style={styles.cueJump}>{active ? "正在播放" : "跳到此处 ▶"}</Text>
                    </Pressable>

                    <Text style={styles.cueEs}>
                      {splitTokens(cue.text).map((tok, tIdx) => {
                        const clean = cleanWordToken(tok);
                        if (!clean) return <Text key={tIdx}>{tok}</Text>;
                        return (
                          <Text
                            key={tIdx}
                            onPress={() => {
                              setSelectedWord(clean);
                              setSelectedContext(cue.text);
                            }}
                            style={styles.wordTap}
                          >
                            {tok}
                          </Text>
                        );
                      })}
                    </Text>

                    {cue.zh ? <Text style={styles.cueZh}>{cue.zh}</Text> : null}
                  </View>
                );
              })
            )}
          </>
        ) : noteParagraphs.length > 0 ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>本期完整简介 / 正文（点击西语词可直接查词）</Text>
            {noteParagraphs.map((para, pIdx) => (
              <Text key={pIdx} style={styles.notesBody}>
                {splitTokens(para).map((tok, tIdx) => {
                  const clean = cleanWordToken(tok);
                  if (!clean) return <Text key={tIdx}>{tok}</Text>;
                  return (
                    <Text
                      key={tIdx}
                      onPress={() => {
                        setSelectedWord(clean);
                        setSelectedContext(para.slice(0, 160));
                      }}
                      style={styles.wordTap}
                    >
                      {tok}
                    </Text>
                  );
                })}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>本期暂无文字简介</Text>
            <Text style={styles.emptyHint}>请切换到「字幕精听」生成双语字幕边听边学。</Text>
          </View>
        )}
      </ScrollView>

      <LookupSheet
        context={selectedContext ?? description.slice(0, 160)}
        language="es"
        onClose={() => setSelectedWord(null)}
        word={selectedWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    height: 46,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A"
  },
  backBtn: { width: 32, alignItems: "center" },
  back: { fontSize: 26, color: "#E2E8F0", lineHeight: 28 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 14.5, fontWeight: "700", color: "#F8FAFC" },
  stage: {
    backgroundColor: "#0F172A",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(99,102,241,0.22)",
    color: "#C7D2FE",
    fontSize: 11,
    fontWeight: "700"
  },
  showName: { flex: 1, fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  statusChip: { fontSize: 11, fontWeight: "600", color: "#CBD5E1" },
  title: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", lineHeight: 23 },
  sliderWrap: { gap: 2, marginTop: 2 },
  clockRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  clock: { fontSize: 11, color: "#94A3B8", fontVariant: ["tabular-nums"] },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: 2
  },
  jumpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  jumpText: { fontSize: 12.5, fontWeight: "700", color: "#E2E8F0" },
  playBtn: {
    minWidth: 100,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22
  },
  playText: { fontSize: 14.5, fontWeight: "700", color: "#FFFFFF" },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 4
  },
  rateRow: { flexDirection: "row", gap: 6 },
  rateChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  rateChipActive: { backgroundColor: colors.brand500 },
  rateText: { fontSize: 11.5, fontWeight: "700", color: "#CBD5E1" },
  rateTextActive: { color: "#FFFFFF" },
  loopBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  loopBtnActive: { backgroundColor: "rgba(99,102,241,0.35)" },
  loopText: { fontSize: 11.5, fontWeight: "600", color: "#E2E8F0" },
  loopTextActive: { color: "#FFFFFF", fontWeight: "700" },
  audioErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(220,38,38,0.2)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  audioErrorText: { flex: 1, fontSize: 12, color: "#FCA5A5" },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#EF4444"
  },
  retryBtnText: { fontSize: 11.5, fontWeight: "700", color: "#FFFFFF" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent"
  },
  tabItemActive: { borderBottomColor: colors.brand500 },
  tabText: { fontSize: 13.5, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: colors.brand600, fontWeight: "700" },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  subActionCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  subActionInfo: { flex: 1, gap: 2 },
  subActionTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  subActionHint: { fontSize: 11.5, color: colors.textSecondary, lineHeight: 16 },
  genSubBtn: {
    backgroundColor: colors.brand600,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center"
  },
  genSubBtnDisabled: { opacity: 0.65 },
  genSubBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  subError: { fontSize: 12.5, color: colors.danger, paddingHorizontal: 4 },
  emptyBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
    gap: 6
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  emptyHint: { fontSize: 12.5, color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
  cueCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6
  },
  cueCardActive: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand500
  },
  cueHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cueTime: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"]
  },
  cueTimeActive: { color: colors.brand700 },
  cueJump: { fontSize: 11, fontWeight: "600", color: colors.brand600 },
  cueEs: { fontSize: 15.5, lineHeight: 24, color: colors.text, fontWeight: "500" },
  cueZh: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  wordTap: { color: colors.text },
  notesCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  notesTitle: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
  notesBody: { fontSize: 15.5, lineHeight: 25, color: colors.text }
});
