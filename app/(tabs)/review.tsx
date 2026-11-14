// Timestamp: 2026-11-15 01:40
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchReviewQueue,
  gradeReviewWord,
  type DueWord,
  type ReviewRating
} from "@/api/review";
import { colors, radius, spacing } from "@/theme";
import { speakSpanish } from "@/lib/speech";
import { usePreferences } from "@/hooks/usePreferences";

const RATING_BUTTONS: Array<{
  rating: ReviewRating;
  label: string;
  color: string;
}> = [
  { rating: "Again", label: "忘了", color: "#DC2626" },
  { rating: "Hard", label: "困难", color: "#EA580C" },
  { rating: "Good", label: "良好", color: colors.brand500 },
  { rating: "Easy", label: "简单", color: "#0284C7" }
];

/** 西语发音(设备端 TTS,不花额度;口音/语速跟随设置页) */
function speakEs(text: string) {
  speakSpanish(text);
}

/**
 * 复习 tab:卡片式刷词。
 * 正面:单词 + 发音 → 翻面看释义 → 四档评分(FSRS 调度) → 下一张。
 * 批末:评分分布小结;点过「忘了」的词可以补练一轮(只重看,不推进 FSRS);
 *       今日还有剩余时自动续批,不用手动点「再取一批」。
 */
export default function ReviewScreen() {
  const [queue, setQueue] = useState<DueWord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState<ReviewRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** 评分后轻提示:"下次 3 天后"(FSRS 的真实反馈,比单纯跳下一张有获得感) */
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  /** 设置页的「复习时自动发音」,开了就每换一张卡自动念单词 */
  const prefs = usePreferences();

  /** 补练轮进行中:重看忘词、只按「记住了」,不调评分接口(纯巩固,不造假数据) */
  const [reinforcing, setReinforcing] = useState(false);
  /** 补练完成后置 true:小结页不再重复推荐补练 */
  const [reinforceDone, setReinforceDone] = useState(false);
  /** 本轮评分分布(跨批累计,小结时展示) */
  const [counts, setCounts] = useState<Record<ReviewRating, number>>({
    Again: 0,
    Hard: 0,
    Good: 0,
    Easy: 0
  });
  const doneTotalRef = useRef(0);
  /** 本会话点过「忘了」的词(批末小结给「再过一遍」用;ref 即可,小结时机必然伴随渲染) */
  const forgottenRef = useRef<DueWord[]>([]);
  /** 自动续批进行中的标记(避免 effect 重复触发) */
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetchReviewQueue();
      setQueue(res.dueWords ?? []);
      setTotalDue(res.totalDue ?? 0);
      setIndex(0);
      setFlipped(false);
      if (!isRefresh) {
        // 全量重取 = 开新的一轮:计数、忘词、补练标记全部归零
        setCounts({ Again: 0, Hard: 0, Good: 0, Easy: 0 });
        setReinforcing(false);
        setReinforceDone(false);
        doneTotalRef.current = 0;
        forgottenRef.current = [];
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** 换了卡片就念一遍(听音辩义:先听再想,比看拼写更接近真实听力) */
  useEffect(() => {
    if (!prefs.autoSpeakReview) return;
    const word = queue[index];
    if (!word?.lemma) return;
    speakSpanish(word.lemma);
  }, [prefs.autoSpeakReview, queue, index]);

  const handleGrade = useCallback(
    async (rating: ReviewRating) => {
      const word = queue[index];
      if (!word || grading) return;

      setGrading(rating);
      try {
        const result = await gradeReviewWord(word.id, rating);
        doneTotalRef.current += 1;
        setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));

        // 点「忘了」的词进补练名单:批末重看一遍,不推进 FSRS(纯巩固,不造假数据)
        if (rating === "Again") {
          const list = forgottenRef.current;
          if (!list.some((item) => item.id === word.id)) list.push(word);
        }

        // 把 ISO 时间翻译成人话,给学习者一个明确的间隔感
        const days = Math.max(
          0,
          Math.round((new Date(result.nextDue).getTime() - Date.now()) / 86_400_000)
        );
        setLastFeedback(
          days <= 0 ? "下次:今天再来一次" : days === 1 ? "下次:明天" : `下次:${days} 天后`
        );
        setTimeout(() => setLastFeedback(null), 2200);

        setFlipped(false);
        setIndex((i) => i + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "评分失败,请重试");
      } finally {
        setGrading(null);
      }
    },
    [queue, index, grading]
  );

  /** 批末取下一批;服务端没货(返回 0 张)就停,避免无限循环 */
  const continueNextBatch = useCallback(async () => {
    if (autoLoading) return;
    setAutoLoading(true);
    try {
      const res = await fetchReviewQueue();
      const next = res.dueWords ?? [];
      setTotalDue(res.totalDue ?? 0);
      if (next.length === 0) return;

      setQueue(next);
      setIndex(0);
      setFlipped(false);
      setAutoNote(`已自动续一批 ${next.length} 张`);
      setTimeout(() => setAutoNote(null), 2500);
    } catch {
      // 拉不到就停在小结页,用户可手动点「再取一批」
    } finally {
      setAutoLoading(false);
    }
  }, [autoLoading]);

  /**
   * 自动续批:刷完一批且今日还有剩余时触发。
   * 有忘词且还没补练时先不自动续,把「再过一遍忘词」的选择留给用户。
   */
  useEffect(() => {
    if (loading || autoLoading) return;
    if (queue.length > 0 && index < queue.length) return;
    if (reinforcing) return;
    if (forgottenRef.current.length > 0 && !reinforceDone) return;
    if (totalDue - doneTotalRef.current <= 0) return;
    void continueNextBatch();
  }, [
    queue,
    index,
    reinforcing,
    reinforceDone,
    loading,
    autoLoading,
    totalDue,
    continueNextBatch
  ]);

  /** 开始补练:把忘词塞回队列顶部重看(不计分) */
  const startReinforce = useCallback(() => {
    const list = forgottenRef.current;
    if (list.length === 0) return;
    setQueue([...list]);
    setIndex(0);
    setFlipped(false);
    setReinforcing(true);
  }, []);

  /** 补练中的「记住了」:只前进,不调接口 */
  const advanceReinforce = useCallback(() => {
    if (index + 1 >= queue.length) {
      // 补练结束:清空队列回到小结页
      setQueue([]);
      setIndex(0);
      setFlipped(false);
      setReinforcing(false);
      setReinforceDone(true);
      return;
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  }, [index, queue.length]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <ActivityIndicator color={colors.brand500} />
        <Text style={styles.loadingText}>正在取复习队列…</Text>
      </SafeAreaView>
    );
  }

  if (error && queue.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => load()} style={styles.retry}>
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const current = queue[index];

  /** 刷完了:评分分布小结 + 忘词补练 + 自动续批 */
  if (!current) {
    const remaining = Math.max(0, totalDue - doneTotalRef.current);
    const forgottenCount = forgottenRef.current.length;
    const offerReinforce = !reinforcing && forgottenCount > 0 && !reinforceDone;
    const reinforceJustFinished = !reinforcing && reinforceDone && forgottenCount > 0;
    const totalGraded = counts.Again + counts.Hard + counts.Good + counts.Easy;

    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.doneEmoji}>{reinforceJustFinished ? "💪" : "🎉"}</Text>
        <Text style={styles.doneTitle}>
          {reinforceJustFinished ? "补练完了" : "这批复习完了"}
        </Text>
        <Text style={styles.doneText}>
          刚才复习了 {totalGraded} 张{remaining > 0 ? `,今日还剩 ${remaining} 张` : ""}
        </Text>

        {/* 评分分布:一眼看出这轮的质量 */}
        {totalGraded > 0 ? (
          <Text style={styles.distribution}>
            忘了 {counts.Again} · 困难 {counts.Hard} · 良好 {counts.Good} · 简单 {counts.Easy}
          </Text>
        ) : null}

        {offerReinforce ? (
          <>
            <Pressable onPress={startReinforce} style={styles.retry}>
              <Text style={styles.retryText}>再过一遍忘词({forgottenCount})</Text>
            </Pressable>
            {remaining > 0 ? (
              <Pressable
                onPress={() => setReinforceDone(true)}
                style={styles.skipButton}
              >
                <Text style={styles.skipText}>跳过,继续复习</Text>
              </Pressable>
            ) : null}
          </>
        ) : autoLoading ? (
          <ActivityIndicator color={colors.brand500} style={styles.autoSpin} />
        ) : (
          <Pressable onPress={() => load()} style={styles.retry}>
            <Text style={styles.retryText}>再取一批</Text>
          </Pressable>
        )}
      </SafeAreaView>
    );
  }

  const meanings = current.dictData?.meanings ?? [];
  const examples = current.dictData?.examples ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* 顶部进度 */}
      <View style={styles.topBar}>
        <Text style={styles.progressText}>
          {index + 1} / {queue.length}
        </Text>
        {reinforcing ? (
          <Text style={styles.feedback}>补练 {forgottenRef.current.length} 个忘词 · 不计分</Text>
        ) : lastFeedback ? (
          <Text style={styles.feedback}>{lastFeedback}</Text>
        ) : (
          <Text style={styles.dueText}>今日待复习 {totalDue}</Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* 卡片正面:单词 + 发音 */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            {current.partOfSpeech ? (
              <Text style={styles.pos}>{current.partOfSpeech}</Text>
            ) : null}
            <Pressable onPress={() => speakEs(current.lemma)} hitSlop={8}>
              <Text style={styles.speakIcon}>🔊</Text>
            </Pressable>
          </View>

          <Text style={styles.lemma}>{current.lemma}</Text>

          {!flipped ? (
            <Pressable
              onPress={() => setFlipped(true)}
              style={styles.revealButton}
            >
              <Text style={styles.revealText}>想不起来?查看释义</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.divider} />

              {current.translation ? (
                <Text style={styles.translation}>{current.translation}</Text>
              ) : null}

              {meanings.length > 0 ? (
                meanings.slice(0, 3).map((m, i) => (
                  <Text key={i} style={styles.meaningLine}>
                    {i + 1}. {m}
                  </Text>
                ))
              ) : null}

              {/* 例句:记忆真正挂钩的地方,之前存了 dictData.examples 但没渲染 */}
              {examples.length > 0 ? (
                <View style={styles.examples}>
                  {examples.slice(0, 2).map((ex, i) => (
                    <View key={i} style={styles.exampleBox}>
                      <Text style={styles.exampleEs}>{ex.es}</Text>
                      {ex.zh ? <Text style={styles.exampleZh}>{ex.zh}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.repsHint}>
                {(current.srsReps ?? 0) > 0
                  ? `已复习 ${current.srsReps} 次`
                  : "第一次见到这个词"}
              </Text>

              {reinforcing ? (
                /* 补练轮:只有一个按钮,不调 FSRS —— 重看的目的是巩固,不是制造复习记录 */
                <Pressable onPress={advanceReinforce} style={styles.reinforceButton}>
                  <Text style={styles.ratingText}>
                    {index + 1 >= queue.length ? "记住了,收工" : "记住了,下一个"}
                  </Text>
                </Pressable>
              ) : (
                /* 四档评分:FSRS 调度下次复习时间 */
                <View style={styles.ratingRow}>
                  {RATING_BUTTONS.map((btn) => (
                    <Pressable
                      disabled={Boolean(grading)}
                      key={btn.rating}
                      onPress={() => void handleGrade(btn.rating)}
                      style={[
                        styles.ratingButton,
                        { backgroundColor: btn.color },
                        grading === btn.rating && styles.ratingButtonActive
                      ]}
                    >
                      <Text style={styles.ratingText}>{btn.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {error ? <Text style={styles.gradeError}>{error}</Text> : null}
            </>
          )}
        </View>

        <Text style={styles.hint}>
          {reinforcing
            ? "补练只重看一遍,不影响复习计划"
            : flipped
              ? "凭诚实评分:想不起来就点「忘了」,间隔会自动缩短"
              : "先自己想意思,再翻面"}
        </Text>
      </ScrollView>

      <Pressable
        onPress={() => load(true)}
        style={styles.refreshLink}
      >
        <Text style={styles.refreshText}>↻ 重新取队列</Text>
      </Pressable>
      {refreshing ? <ActivityIndicator style={styles.refreshSpin} color={colors.brand500} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgSubtle,
    gap: spacing.md,
    paddingHorizontal: spacing.xl
  },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  errorTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  errorText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  doneEmoji: { fontSize: 44 },
  doneTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  doneText: { fontSize: 13.5, color: colors.textSecondary, textAlign: "center" },
  distribution: { fontSize: 12.5, color: colors.textTertiary },
  skipButton: { marginTop: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  skipText: { fontSize: 13, color: colors.textTertiary },
  autoSpin: { marginTop: spacing.md },
  reinforceButton: {
    marginTop: spacing.xl,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md
  },
  progressText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand700
  },
  dueText: { fontSize: 12, color: colors.textTertiary },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  pos: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  speakIcon: { fontSize: 20 },
  lemma: {
    marginTop: spacing.md,
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6
  },
  revealButton: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  revealText: { fontSize: 14, fontWeight: "700", color: colors.brand700 },
  divider: {
    marginTop: spacing.lg,
    height: 1,
    backgroundColor: colors.border
  },
  translation: {
    marginTop: spacing.lg,
    fontSize: 19,
    fontWeight: "700",
    color: colors.text
  },
  meaningLine: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary
  },
  examples: { marginTop: spacing.md, gap: spacing.sm },
  exampleBox: {
    borderLeftWidth: 2,
    borderLeftColor: colors.brand100,
    paddingLeft: 9,
    gap: 2
  },
  exampleEs: { fontSize: 13.5, lineHeight: 20, color: colors.text },
  exampleZh: { fontSize: 12, lineHeight: 18, color: colors.textTertiary },
  repsHint: { marginTop: spacing.sm, fontSize: 11, color: colors.textTertiary },
  feedback: { fontSize: 12, fontWeight: "700", color: colors.brand600 },
  ratingRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: 8
  },
  ratingButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center"
  },
  ratingButtonActive: { opacity: 0.6 },
  ratingText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  gradeError: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.danger,
    textAlign: "center"
  },
  hint: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center"
  },
  refreshLink: { alignItems: "center", paddingBottom: spacing.lg },
  refreshText: { fontSize: 12, color: colors.textTertiary },
  refreshSpin: { position: "absolute", bottom: 40, alignSelf: "center" }
});
