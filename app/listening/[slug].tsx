// Timestamp: 2026-11-14 22:02
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { fetchStory, type LecturaStory } from "@/api/lectura";
import { LookupSheet } from "@/components/LookupSheet";
import { ParagraphBlock } from "@/components/ParagraphBlock";
import { LISTEN_RATES, useListeningPlayer } from "@/hooks/useListeningPlayer";
import { speakSpanish } from "@/lib/speech";
import {
  CAUSE_OPTIONS,
  RATIO_OPTIONS,
  getStorySummary,
  loadListeningLog,
  saveParagraphLog,
  type ListenCause,
  type ListenRatio,
  type StorySummary
} from "@/lib/listeningProgress";
import { colors, radius, spacing } from "@/theme";

/**
 * 精听一篇。
 *
 * 刻意做成"看不见文本"的强约束流程：盲听阶段文本被遮住，只有揭晓后才能对照。
 * 因为一旦能瞄到原文，眼睛会立刻接管、耳朵就偷懒（这就是"阅读能懂、听力慢半拍"的成因）。
 *
 * 每段结束要求做两件事：给一个听懂率区间、勾选错因。错因才是可执行的部分——
 * 没听出音要练跟读、词不认识要补词库、认识没反应要练速度，三条路完全不同。
 */
export default function ListeningPracticeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const storySlug = slug ? String(slug) : undefined;

  const [story, setStory] = useState<LecturaStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratio, setRatio] = useState<ListenRatio | null>(null);
  const [causes, setCauses] = useState<ListenCause[]>([]);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<StorySummary | null>(null);

  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>(undefined);

  const player = useListeningPlayer(storySlug);

  const paragraphs = useMemo(() => story?.paragraphs ?? [], [story]);
  const total = paragraphs.length;
  const paragraph = paragraphs[index] ?? "";

  const load = useCallback(async () => {
    if (!storySlug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStory(storySlug);
      await loadListeningLog();
      setStory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [storySlug]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 换段就清状态：不复位的话会把上一段的评分带到下一段 */
  const goToParagraph = useCallback(
    (next: number) => {
      player.resetPlays();
      player.stop();
      setIndex(next);
      setRevealed(false);
      setRatio(null);
      setCauses([]);
    },
    [player]
  );

  const toggleCause = useCallback((value: ListenCause) => {
    setCauses((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }, []);

  const finish = useCallback(async () => {
    if (!storySlug) return;
    await loadListeningLog();
    setSummary(getStorySummary(storySlug, total));
    setFinished(true);
    player.stop();
  }, [player, storySlug, total]);

  const saveAndNext = useCallback(async () => {
    if (!storySlug || !ratio) return;

    await saveParagraphLog(storySlug, index, {
      ratio,
      causes,
      plays: player.plays,
      at: new Date().toISOString()
    });

    if (index + 1 >= total) await finish();
    else goToParagraph(index + 1);
  }, [causes, finish, goToParagraph, index, player.plays, ratio, storySlug, total]);

  const skipParagraph = useCallback(() => {
    if (index + 1 >= total) void finish();
    else goToParagraph(index + 1);
  }, [finish, goToParagraph, index, total]);

  const openLookup = useCallback((word: string, context?: string) => {
    const clean = word.trim();
    if (!clean) return;
    setLookupContext(context);
    setLookupWord(clean);
  }, []);

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !story) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "没有找到这篇材料"}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {story.titleZh || story.title}
        </Text>
        {!finished ? (
          <Text style={styles.counter}>
            {index + 1}/{total}
          </Text>
        ) : null}
      </View>

      {finished ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.doneTitle}>这一篇练完了</Text>
          <Text style={styles.doneSub}>
            {story.title} · {story.titleZh}
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>平均听懂率</Text>
            <Text style={styles.summaryValue}>
              {summary?.average !== null && summary?.average !== undefined
                ? `${summary.average}%`
                : "—"}
            </Text>
            <Text style={styles.summaryHint}>{verdict(summary?.average ?? null)}</Text>
          </View>

          {summary?.topCause ? (
            <View style={styles.adviceCard}>
              <Text style={styles.adviceTitle}>
                主要卡点:{CAUSE_OPTIONS.find((item) => item.value === summary.topCause)?.label}
              </Text>
              <Text style={styles.adviceBody}>
                {CAUSE_OPTIONS.find((item) => item.value === summary.topCause)?.advice}
              </Text>
            </View>
          ) : null}

          <Pressable onPress={() => router.push("/listening" as never)} style={styles.primary}>
            <Text style={styles.primaryText}>换一篇材料</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setFinished(false);
              setSummary(null);
              goToParagraph(0);
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>这篇再练一遍</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.stageCard}>
            <Text style={styles.stageLabel}>
              {revealed ? "对照原文" : "盲听 · 先别看文本"}
            </Text>

            <Pressable
              onPress={() => player.toggle(index)}
              style={[styles.playButton, player.isPlaying && styles.playButtonOn]}
            >
              <Text style={[styles.playIcon, player.isPlaying && styles.playIconOn]}>
                {player.isPlaying ? "■" : "▶"}
              </Text>
              <Text style={[styles.playText, player.isPlaying && styles.playTextOn]}>
                {player.isPlaying ? "停止" : player.plays > 0 ? "再听一遍" : "开始听"}
              </Text>
            </Pressable>

            <Text style={styles.playsNote}>
              {player.plays === 0 ? "还没听" : `这一段已听 ${player.plays} 遍`}
            </Text>

            <View style={styles.rateRow}>
              {LISTEN_RATES.map((option) => {
                const active = player.rate === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => player.setRate(option.value)}
                    style={[styles.rateChip, active && styles.rateChipActive]}
                  >
                    <Text style={[styles.rateText, active && styles.rateTextActive]}>
                      {option.label} · {option.value}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {player.error ? (
              <Pressable onPress={() => speakSpanish(paragraph)} style={styles.fallbackSpeak}>
                <Text style={styles.fallbackText}>这段没有音频,点这里用设备朗读代替</Text>
              </Pressable>
            ) : null}
          </View>

          {revealed ? (
            <>
              <View style={styles.textCard}>
                <ParagraphBlock
                  first
                  onWordPress={(word) => openLookup(word, paragraph)}
                  text={paragraph}
                />
                <Pressable
                  onPress={() => speakSpanish(paragraph)}
                  style={styles.listenAgain}
                >
                  <Text style={styles.listenAgainText}>🔊 设备朗读整段</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>这一段听懂了多少</Text>
              <View style={styles.ratioGrid}>
                {RATIO_OPTIONS.map((option) => {
                  const active = ratio === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRatio(option.value)}
                      style={[styles.ratioCard, active && styles.ratioCardActive]}
                    >
                      <Text style={[styles.ratioLabel, active && styles.ratioLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.ratioHint, active && styles.ratioHintActive]}>
                        {option.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>卡在哪里(可多选,也可以不选)</Text>
              <View style={styles.causeRow}>
                {CAUSE_OPTIONS.map((option) => {
                  const active = causes.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => toggleCause(option.value)}
                      style={[styles.causeChip, active && styles.causeChipActive]}
                    >
                      <Text style={[styles.causeLabel, active && styles.causeLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.causeHint, active && styles.causeHintActive]}>
                        {option.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                disabled={!ratio}
                onPress={() => void saveAndNext()}
                style={[styles.primary, !ratio && styles.primaryDisabled]}
              >
                <Text style={styles.primaryText}>
                  {index + 1 >= total ? "完成本篇" : "保存,下一段"}
                </Text>
              </Pressable>
              <Pressable onPress={skipParagraph} style={styles.secondary}>
                <Text style={styles.secondaryText}>这段跳过</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setRevealed(true)} style={styles.primary}>
                <Text style={styles.primaryText}>揭晓原文</Text>
              </Pressable>
              <Text style={styles.blindHint}>
                先听两遍再说。真听不懂也没关系——听不懂的地方才是这次要练的地方。
              </Text>
              <Pressable onPress={skipParagraph} style={styles.secondary}>
                <Text style={styles.secondaryText}>这段跳过</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      <LookupSheet
        context={lookupContext}
        onClose={() => setLookupWord(null)}
        word={lookupWord}
      />
    </SafeAreaView>
  );
}

/** 按 70–90% 最佳区的经验标尺给一句话结论，不给分数排名 */
function verdict(average: number | null) {
  if (average === null) return "还没有自评数据";
  if (average >= 95) return "太轻松了,换难一档的材料";
  if (average >= 70) return "落在最佳训练区,保持这个难度";
  if (average >= 50) return "偏难:先用 0.75x 重听,再回原速";
  return "这段超出当前水平,换更简单的材料或先补生词";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  counter: { fontSize: 12, fontWeight: "700", color: colors.textTertiary },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  stageCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.brand600
  },
  playButton: {
    marginTop: spacing.sm,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.brand50,
    borderWidth: 2,
    borderColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  playButtonOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  playIcon: { fontSize: 30, color: colors.brand700 },
  playIconOn: { color: "#FFFFFF" },
  playText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  playTextOn: { color: "#FFFFFF" },
  playsNote: { fontSize: 12, color: colors.textSecondary },
  rateRow: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  rateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  rateChipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  rateText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  rateTextActive: { color: "#FFFFFF" },
  fallbackSpeak: { marginTop: spacing.sm, paddingVertical: 6 },
  fallbackText: { fontSize: 12, color: colors.danger },
  textCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm
  },
  listenAgain: { alignSelf: "flex-start", paddingVertical: 4 },
  listenAgainText: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSecondary
  },
  ratioGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  ratioCard: {
    width: "48.5%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.md,
    gap: 3
  },
  ratioCardActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  ratioLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  ratioLabelActive: { color: colors.brand700 },
  ratioHint: { fontSize: 11, lineHeight: 15, color: colors.textTertiary },
  ratioHintActive: { color: colors.brand600 },
  causeRow: { flexDirection: "row", gap: spacing.sm },
  causeChip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    gap: 2
  },
  causeChipActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  causeLabel: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  causeLabelActive: { color: colors.brand700 },
  causeHint: { fontSize: 10.5, lineHeight: 14, color: colors.textTertiary },
  causeHintActive: { color: colors.brand600 },
  primary: {
    marginTop: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryDisabled: { backgroundColor: colors.border },
  primaryText: { fontSize: 14.5, fontWeight: "700", color: "#FFFFFF" },
  secondary: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryText: { fontSize: 13.5, fontWeight: "600", color: colors.textSecondary },
  blindHint: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textTertiary,
    textAlign: "center"
  },
  doneTitle: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
  doneSub: { fontSize: 12.5, color: colors.textSecondary },
  summaryCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4
  },
  summaryLabel: { fontSize: 11.5, fontWeight: "700", color: colors.brand600 },
  summaryValue: { fontSize: 34, fontWeight: "800", color: colors.brand700, letterSpacing: -1 },
  summaryHint: { fontSize: 12.5, color: colors.brand700 },
  adviceCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4
  },
  adviceTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  adviceBody: { fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  retryText: { fontSize: 13, fontWeight: "600", color: colors.brand700 }
});
