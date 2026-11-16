// Timestamp: 2026-11-16 09:22
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchPodcastSubtitles,
  getProxiedCoverUrl,
  getProxiedPodcastAudioUrl,
  type PodcastCue
} from "@/api/podcasts";
import { LookupSheet } from "@/components/LookupSheet";
import { useBackgroundMedia } from "@/context/BackgroundMediaContext";
import { detectPhrasesInSentence, type DetectedPhraseSpan } from "@/lib/phraseDetector";
import { colors, radius, spacing } from "@/theme";

const RATES = [0.75, 0.9, 1.0, 1.2] as const;
const WINDOW_SEC = 30;
/** 每轮批量预缓冲 3 分钟（6 × 30s），且保持至少 90s（1.5 分钟）安全余量 */
const BATCH_WINDOW_COUNT = 6;
const REBUFFER_MARGIN_SEC = 90;
const MAX_SUB_WORKERS = 2;

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
    id?: string;
    title?: string;
    showTitle?: string;
    level?: string;
    audioUrl?: string;
    description?: string;
    durationSec?: string;
    coverUrl?: string;
    link?: string;
  }>();

  const episodeId = typeof params.id === "string" ? params.id : undefined;
  const title = typeof params.title === "string" ? params.title : "西语播客";
  const showTitle = typeof params.showTitle === "string" ? params.showTitle : "Podcast";
  const level = typeof params.level === "string" ? params.level : "B1";
  const rawAudioUrl = typeof params.audioUrl === "string" ? params.audioUrl : "";
  const description = typeof params.description === "string" ? params.description : "";
  const initialDurationSec = Number(params.durationSec) || 0;
  const rawCoverUrl = typeof params.coverUrl === "string" ? params.coverUrl : "";
  const episodeLink = typeof params.link === "string" ? params.link : "";

  const playbackUrl = useMemo(() => getProxiedPodcastAudioUrl(rawAudioUrl), [rawAudioUrl]);
  const proxiedCoverUrl = useMemo(
    () => (rawCoverUrl ? getProxiedCoverUrl(rawCoverUrl) ?? rawCoverUrl : null),
    [rawCoverUrl]
  );

  const {
    podcastStatus: status,
    podcastRate: rate,
    podcastLoopAnchor: loopAnchor,
    podcastAudioError: audioError,
    openPodcast,
    togglePodcastPlay: togglePlay,
    seekPodcastTo,
    jumpPodcastBy: jumpBy,
    setPodcastRate: setRate,
    togglePodcastLoop: toggleLoop,
    retryPodcastAudio: retryAudio
  } = useBackgroundMedia();

  const [activeTab, setActiveTab] = useState<BottomTab>("subtitles");

  const [cues, setCues] = useState<PodcastCue[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [bufferedUntilSec, setBufferedUntilSec] = useState(0);
  const [subSourceLabel, setSubSourceLabel] = useState<string | null>(null);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | undefined>(undefined);

  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const cueYMap = useRef<Record<number, number>>({});
  const completedWindows = useRef<Set<number>>(new Set());
  const inFlightWindows = useRef<Set<number>>(new Set());
  const pendingQueue = useRef<number[]>([]);
  const activeWorkers = useRef(0);
  const episodeGenRef = useRef(0);

  const duration = status.duration || initialDurationSec || 0;
  const currentTime = status.currentTime || 0;

  // 把节目注册到根级后台播放器：离开当前页或熄屏后继续播
  useEffect(() => {
    if (!playbackUrl) return;
    openPodcast({
      id: episodeId,
      title,
      showTitle,
      level,
      rawAudioUrl,
      playbackUrl,
      description,
      durationSec: initialDurationSec > 0 ? initialDurationSec : undefined,
      coverUrl: rawCoverUrl || undefined,
      link: episodeLink || undefined
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackUrl]);

  const recomputeBufferedUntil = useCallback(
    (anchorSec: number) => {
      const startWin = Math.floor(Math.max(0, anchorSec) / WINDOW_SEC) * WINDOW_SEC;
      let cursor = startWin;
      while (completedWindows.current.has(cursor)) {
        cursor += WINDOW_SEC;
      }
      setBufferedUntilSec(cursor);
    },
    []
  );

  const pumpQueue = useCallback(() => {
    if (!rawAudioUrl) return;
    const gen = episodeGenRef.current;

    const runOne = async (winSec: number, isManualPriority: boolean) => {
      try {
        const res = await fetchPodcastSubtitles({
          audioUrl: rawAudioUrl,
          startSec: winSec,
          durationSec: duration > 0 ? Math.round(duration) : undefined,
          pageUrl: episodeLink || undefined,
          sourceText: description.trim().length >= 450 ? description : undefined
        });
        if (episodeGenRef.current !== gen) return;

        completedWindows.current.add(winSec);
        if (res.source === "transcript") setSubSourceLabel("源文稿");
        else if (res.source === "article-text") setSubSourceLabel("文章正文");
        else if (res.source === "ai-asr") setSubSourceLabel((prev) => prev ?? "AI 听译");

        if (res.cues && res.cues.length > 0) {
          setCues((prev) => mergeSortedCues(prev, res.cues));
        } else if (isManualPriority && winSec === 0) {
          setSubError("开篇片头暂无人声，已继续向后缓冲前 3 分钟字幕…");
        }
        recomputeBufferedUntil(currentTime);
      } catch (e) {
        if (episodeGenRef.current !== gen) return;
        if (isManualPriority) {
          setSubError(e instanceof Error ? e.message : "字幕生成失败，请点重试");
        }
      } finally {
        inFlightWindows.current.delete(winSec);
        if (episodeGenRef.current === gen) {
          setSubLoading(inFlightWindows.current.size > 0 || pendingQueue.current.length > 0);
        }
      }
    };

    while (activeWorkers.current < MAX_SUB_WORKERS && pendingQueue.current.length > 0) {
      const nextWin = pendingQueue.current.shift()!;
      if (completedWindows.current.has(nextWin) || inFlightWindows.current.has(nextWin)) {
        continue;
      }
      inFlightWindows.current.add(nextWin);
      setSubLoading(true);
      activeWorkers.current += 1;
      void runOne(nextWin, nextWin === 0).finally(() => {
        activeWorkers.current = Math.max(0, activeWorkers.current - 1);
        if (episodeGenRef.current === gen) {
          pumpQueue();
        }
      });
    }
  }, [rawAudioUrl, duration, episodeLink, description, currentTime, recomputeBufferedUntil]);

  const scheduleRangeFrom = useCallback(
    (anchorSec: number, front = false, forceRetry = false) => {
      if (!rawAudioUrl) return;
      const startWin = Math.floor(Math.max(0, anchorSec) / WINDOW_SEC) * WINDOW_SEC;
      const maxEnd = duration > 0 ? Math.ceil(duration) : startWin + BATCH_WINDOW_COUNT * WINDOW_SEC;
      const batch: number[] = [];

      for (let i = 0; i < BATCH_WINDOW_COUNT; i += 1) {
        const win = startWin + i * WINDOW_SEC;
        if (duration > 0 && win >= maxEnd) break;
        if (forceRetry && i === 0) {
          completedWindows.current.delete(win);
        }
        if (
          !completedWindows.current.has(win) &&
          !inFlightWindows.current.has(win) &&
          !pendingQueue.current.includes(win)
        ) {
          batch.push(win);
        }
      }

      if (batch.length === 0) return;
      setSubError(null);

      if (front) {
        pendingQueue.current = [...batch, ...pendingQueue.current];
      } else {
        pendingQueue.current = [...pendingQueue.current, ...batch];
      }
      pumpQueue();
    },
    [rawAudioUrl, duration, pumpQueue]
  );

  // 开局预缓冲前 3 分钟（0:00~3:00）：优先 0~30s 尽快落屏，其余 5 段紧随并发填充
  useEffect(() => {
    if (!rawAudioUrl) return;
    episodeGenRef.current += 1;
    completedWindows.current.clear();
    inFlightWindows.current.clear();
    pendingQueue.current = [];
    activeWorkers.current = 0;
    setCues([]);
    setBufferedUntilSec(0);
    setSubSourceLabel(null);
    scheduleRangeFrom(0, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAudioUrl]);

  // 滑动超前缓冲：只要未来 REBUFFER_MARGIN_SEC（90s，留足 >1 分钟余量）内存在未生成段落，
  // 立即以 3 分钟为一批续订（如播到 1:30~2:00 即拉取 3:00~6:00，播到 4:30~5:00 即拉取 6:00~9:00）
  useEffect(() => {
    if (!rawAudioUrl) return;
    const baseWin = Math.floor(Math.max(0, currentTime) / WINDOW_SEC) * WINDOW_SEC;
    const horizonWin = Math.floor((Math.max(0, currentTime) + REBUFFER_MARGIN_SEC) / WINDOW_SEC) * WINDOW_SEC;
    const maxEnd = duration > 0 ? Math.ceil(duration) : horizonWin + WINDOW_SEC;

    recomputeBufferedUntil(currentTime);

    for (let win = baseWin; win <= horizonWin; win += WINDOW_SEC) {
      if (duration > 0 && win >= maxEnd) break;
      if (
        !completedWindows.current.has(win) &&
        !inFlightWindows.current.has(win) &&
        !pendingQueue.current.includes(win)
      ) {
        // 如果当前播放点这一窗还没出（刚拖动进度条），置顶加急；否则按顺序批拉 3 分钟
        scheduleRangeFrom(win, win === baseWin, false);
        break;
      }
    }
  }, [currentTime, duration, rawAudioUrl, scheduleRangeFrom, recomputeBufferedUntil]);

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

  const seekToCue = useCallback(
    (startSec: number) => {
      seekPodcastTo(Math.max(0, startSec));
      if (!status.playing) {
        togglePlay();
      }
    },
    [seekPodcastTo, status.playing, togglePlay]
  );

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
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.minBtn}>
          <Text style={styles.minBtnText}>后台听</Text>
        </Pressable>
      </View>

      {/* 深色音频舞台：封面 + 后台/锁屏播提示 + 精听控制台 */}
      <View style={styles.stage}>
        <View style={styles.heroRow}>
          {proxiedCoverUrl ? (
            <Image source={{ uri: proxiedCoverUrl }} style={styles.coverArt} />
          ) : (
            <View style={styles.coverFallback}>
              <Text style={styles.coverFallbackIcon}>🎧</Text>
            </View>
          )}
          <View style={styles.heroTextCol}>
            <View style={styles.metaRow}>
              <Text style={styles.levelBadge}>{level}</Text>
              <Text numberOfLines={1} style={styles.showName}>
                {showTitle}
              </Text>
              <Text style={styles.bgPill}>后台/熄屏播</Text>
            </View>
            <Text numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <Text style={styles.statusChip}>
              {status.isBuffering && !status.playing
                ? "● 缓冲中…"
                : status.playing
                  ? "● 正在播放 · 支持熄屏收听"
                  : status.isLoaded
                    ? "已就绪"
                    : rawAudioUrl
                      ? "正在连接音频"
                      : "无音频"}
            </Text>
          </View>
        </View>

        <View style={styles.sliderWrap}>
          <Slider
            maximumTrackTintColor="rgba(255,255,255,0.22)"
            maximumValue={Math.max(1, duration)}
            minimumTrackTintColor={colors.brand500}
            minimumValue={0}
            onSlidingComplete={(val) => {
              seekPodcastTo(val);
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
                <Text style={styles.subActionTitle}>
                  双语字幕 {subSourceLabel ? `· ${subSourceLabel}` : "· 优先源文稿"}
                </Text>
                <Text style={styles.subActionHint}>
                  {bufferedUntilSec > 0
                    ? `已超前缓冲至 ${formatClock(bufferedUntilSec)}（余量 ≥1.5 分钟自动续订下 3 分钟），点固定搭配/单词可直接查词`
                    : "开局自动缓冲前 3 分钟字幕，优先匹配源文稿与固定搭配识别"}
                </Text>
              </View>
              <Pressable
                disabled={!rawAudioUrl}
                onPress={() => scheduleRangeFrom(currentTime, true, true)}
                style={[styles.genSubBtn, subLoading && styles.genSubBtnDisabled]}
              >
                {subLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.genSubBtnText}>
                    补齐 {formatClock(Math.floor(currentTime / WINDOW_SEC) * WINDOW_SEC)}
                  </Text>
                )}
              </Pressable>
            </View>

            {subError ? <Text style={styles.subError}>{subError}</Text> : null}

            {cues.length === 0 && !subLoading ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>当前片段还没有字幕</Text>
                <Text style={styles.emptyHint}>
                  点击上方按钮即可优先拉取源文稿或生成该段双语字幕。
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

                    <InteractiveSpanishBlock
                      onSelectWord={(target) => {
                        setSelectedWord(target);
                        setSelectedContext(cue.text);
                      }}
                      text={cue.text}
                      textStyle={styles.cueEs}
                    />

                    {cue.zh ? <Text style={styles.cueZh}>{cue.zh}</Text> : null}
                  </View>
                );
              })
            )}
          </>
        ) : noteParagraphs.length > 0 ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>
              本期完整简介 / 正文（自动识别固定搭配，点击词组可直接查词）
            </Text>
            {noteParagraphs.map((para, pIdx) => (
              <InteractiveSpanishBlock
                key={pIdx}
                onSelectWord={(target) => {
                  setSelectedWord(target);
                  setSelectedContext(para.slice(0, 160));
                }}
                text={para}
                textStyle={styles.notesBody}
              />
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

/** 渲染播客西语段落/字幕并自动高亮固定搭配 */
function InteractiveSpanishBlock({
  text,
  textStyle,
  onSelectWord
}: {
  text: string;
  textStyle: object;
  onSelectWord: (wordOrPhrase: string) => void;
}) {
  const spans = useMemo<DetectedPhraseSpan[]>(() => detectPhrasesInSentence(text), [text]);
  const uniqueSpans = useMemo(() => {
    const seen = new Set<string>();
    return spans.filter((s) => {
      if (seen.has(s.lemma)) return false;
      seen.add(s.lemma);
      return true;
    });
  }, [spans]);

  const segments = useMemo(() => {
    type Seg =
      | { kind: "phrase"; raw: string; lemma: string }
      | { kind: "chunk"; raw: string };
    const out: Seg[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor) {
        out.push({ kind: "chunk", raw: text.slice(cursor, span.start) });
      }
      if (span.end > span.start) {
        out.push({ kind: "phrase", raw: text.slice(span.start, span.end), lemma: span.lemma });
        cursor = span.end;
      }
    }
    if (cursor < text.length) {
      out.push({ kind: "chunk", raw: text.slice(cursor) });
    }
    return out;
  }, [text, spans]);

  return (
    <View style={styles.spanBlock}>
      <Text style={textStyle}>
        {segments.map((seg, sIdx) => {
          if (seg.kind === "phrase") {
            return (
              <Text
                key={sIdx}
                onPress={() => onSelectWord(seg.lemma)}
                style={styles.phraseTap}
              >
                {seg.raw}
              </Text>
            );
          }
          return splitTokens(seg.raw).map((tok, tIdx) => {
            const clean = cleanWordToken(tok);
            if (!clean) return <Text key={`${sIdx}-${tIdx}`}>{tok}</Text>;
            return (
              <Text
                key={`${sIdx}-${tIdx}`}
                onPress={() => onSelectWord(clean)}
                style={styles.wordTap}
              >
                {tok}
              </Text>
            );
          });
        })}
      </Text>

      {uniqueSpans.length > 0 ? (
        <View style={styles.collocationRow}>
          {uniqueSpans.map((span) => (
            <Pressable
              key={span.lemma}
              hitSlop={6}
              onPress={() => onSelectWord(span.lemma)}
              style={styles.collocationChip}
            >
              <Text style={styles.collocationBadge}>搭配</Text>
              <Text style={styles.collocationLemma}>{span.lemma}</Text>
              {span.zh ? (
                <Text numberOfLines={1} style={styles.collocationZh}>
                  · {span.zh}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
  backBtn: { width: 48, alignItems: "flex-start" },
  back: { fontSize: 26, color: "#E2E8F0", lineHeight: 28 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 14.5, fontWeight: "700", color: "#F8FAFC" },
  minBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  minBtnText: { fontSize: 11.5, fontWeight: "700", color: "#E2E8F0" },
  stage: {
    backgroundColor: "#0F172A",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coverArt: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  coverFallback: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center"
  },
  coverFallbackIcon: { fontSize: 28 },
  heroTextCol: { flex: 1, gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "rgba(99,102,241,0.22)",
    color: "#C7D2FE",
    fontSize: 11,
    fontWeight: "700"
  },
  showName: { flex: 1, fontSize: 11.5, fontWeight: "600", color: "#94A3B8" },
  bgPill: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#34D399",
    backgroundColor: "rgba(16,185,129,0.14)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  statusChip: { fontSize: 11.5, fontWeight: "600", color: "#94A3B8" },
  title: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", lineHeight: 22 },
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
  spanBlock: { gap: 4 },
  phraseTap: {
    color: "#B45309",
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(217, 119, 6, 0.55)"
  },
  collocationRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  collocationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  collocationBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
    backgroundColor: "rgba(217, 119, 6, 0.16)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden"
  },
  collocationLemma: { fontSize: 12, fontWeight: "700", color: "#78350F" },
  collocationZh: { fontSize: 11.5, fontWeight: "500", color: "#92400E", maxWidth: 140 },
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
