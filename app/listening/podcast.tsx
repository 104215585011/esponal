// Timestamp: 2026-11-15 08:00
import { useCallback, useEffect, useMemo, useState } from "react";
import Slider from "@react-native-community/slider";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
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

import { LookupSheet } from "@/components/LookupSheet";
import { colors, radius, spacing } from "@/theme";

const RATES = [0.75, 0.9, 1.0] as const;

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

/** 播客流式精听播放器：变速播放、前后快跳 15s、30s 片段自动循环精听、简介点词查变位 */
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
  const audioUrl = typeof params.audioUrl === "string" ? params.audioUrl : "";
  const description = typeof params.description === "string" ? params.description : "";

  const player = useAudioPlayer(audioUrl ? { uri: audioUrl } : null);
  const status = useAudioPlayerStatus(player);

  const [rate, setRate] = useState<number>(1.0);
  const [loopAnchor, setLoopAnchor] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const duration = status.duration || Number(params.durationSec) || 0;
  const currentTime = status.currentTime || 0;

  // 保持播放速度设置
  useEffect(() => {
    if (!status.isLoaded) return;
    try {
      player.setPlaybackRate(rate, "medium");
    } catch {
      // 忽略加载过渡期报错
    }
  }, [status.isLoaded, rate, player]);

  // 30 秒片段循坏：播完 [anchor, anchor+30] 后自动拉回 anchor
  useEffect(() => {
    if (loopAnchor === null || !status.playing) return;
    if (currentTime >= loopAnchor + 30) {
      void player.seekTo(loopAnchor);
    }
  }, [loopAnchor, currentTime, status.playing, player]);

  const togglePlay = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [status.playing, player]);

  const jumpBy = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(duration || 3600, currentTime + delta));
      void player.seekTo(next);
    },
    [currentTime, duration, player]
  );

  const toggleLoop = useCallback(() => {
    setLoopAnchor((prev) => (prev === null ? Math.max(0, Math.floor(currentTime)) : null));
  }, [currentTime]);

  const tokens = useMemo(() => (description ? splitTokens(description) : []), [description]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {showTitle}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.playerCard}>
          <View style={styles.metaRow}>
            <Text style={styles.levelBadge}>{level}</Text>
            <Text style={styles.showName}>{showTitle}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          {/* 进度条 */}
          <View style={styles.sliderWrap}>
            <Slider
              maximumTrackTintColor={colors.border}
              maximumValue={Math.max(1, duration)}
              minimumTrackTintColor={colors.brand500}
              minimumValue={0}
              onSlidingComplete={(val) => {
                void player.seekTo(val);
              }}
              thumbTintColor={colors.brand600}
              value={Math.min(currentTime, Math.max(1, duration))}
            />
            <View style={styles.clockRow}>
              <Text style={styles.clock}>{formatClock(currentTime)}</Text>
              <Text style={styles.clock}>{formatClock(duration)}</Text>
            </View>
          </View>

          {/* 主控按钮 */}
          <View style={styles.controlsRow}>
            <Pressable onPress={() => jumpBy(-15)} style={styles.jumpBtn}>
              <Text style={styles.jumpText}>-15s</Text>
            </Pressable>

            <Pressable onPress={togglePlay} style={styles.playBtn}>
              {status.isBuffering && !status.playing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.playText}>{status.playing ? "暂停" : "播放"}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => jumpBy(15)} style={styles.jumpBtn}>
              <Text style={styles.jumpText}>+15s</Text>
            </Pressable>
          </View>

          {/* 倍速与 30s 循环 */}
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
        </View>

        {description ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>本期简介（点击西语词可直接查词）</Text>
            <Text style={styles.notesBody}>
              {tokens.map((tok, idx) => {
                const clean = cleanWordToken(tok);
                if (!clean) return <Text key={idx}>{tok}</Text>;
                return (
                  <Text key={idx} onPress={() => setSelectedWord(clean)}>
                    {tok}
                  </Text>
                );
              })}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <LookupSheet
        context={description.slice(0, 160)}
        onClose={() => setSelectedWord(null)}
        word={selectedWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    height: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  backBtn: { width: 32, alignItems: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15.5, fontWeight: "700", color: colors.text },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  playerCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  showName: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  title: { fontSize: 18, fontWeight: "800", lineHeight: 25, color: colors.text },
  sliderWrap: { marginTop: spacing.xs },
  clockRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -2 },
  clock: { fontSize: 11.5, color: colors.textTertiary },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    marginTop: spacing.xs
  },
  jumpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  jumpText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  playBtn: {
    width: 84,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center"
  },
  playText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  toolsRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  rateRow: { flexDirection: "row", gap: 6 },
  rateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  rateChipActive: { backgroundColor: colors.brand50 },
  rateText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  rateTextActive: { color: colors.brand700, fontWeight: "700" },
  loopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  loopBtnActive: {
    backgroundColor: colors.indigo50,
    borderColor: colors.indigo600
  },
  loopText: { fontSize: 11.5, fontWeight: "600", color: colors.textSecondary },
  loopTextActive: { color: colors.indigo600, fontWeight: "700" },
  notesCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm
  },
  notesTitle: { fontSize: 12.5, fontWeight: "700", color: colors.textSecondary },
  notesBody: { fontSize: 14.5, lineHeight: 23, color: colors.text }
});
