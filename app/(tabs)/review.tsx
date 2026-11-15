// Timestamp: 2026-11-15 08:08
import { useCallback, useEffect, useRef, useState } from "react";
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

import {
  fetchReviewQueue,
  gradeReviewWord,
  type DueWord,
  type ReviewRating
} from "@/api/review";
import { AppIcon } from "@/components/AppIcon";
import { PhrasesListPanel } from "@/components/PhrasesListPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { VocabListPanel } from "@/components/VocabListPanel";
import { usePreferences } from "@/hooks/usePreferences";
import { getPreferences, LEARNING_LANGUAGE_OPTIONS } from "@/lib/preferences";
import { speakAuto } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

type ReviewTab = "queue" | "vocab" | "phrases";

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

function speakEs(text: string) {
  const lang = getPreferences().learningLang;
  const opt = LEARNING_LANGUAGE_OPTIONS.find((o) => o.value === lang);
  speakAuto(text, { fallbackLang: opt?.ttsLang ?? lang });
}

/**
 * 复习与词库中心：
 * 顶部三段切换「今日复习 / 我的词库 / 短语搭配」，把原本散落在「我的」里的词汇资产统一收口。
 */
export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [subTab, setSubTab] = useState<ReviewTab>(
    params.tab === "vocab" ? "vocab" : params.tab === "phrases" ? "phrases" : "queue"
  );

  useEffect(() => {
    if (params.tab === "vocab" || params.tab === "phrases" || params.tab === "queue") {
      setSubTab(params.tab);
    }
  }, [params.tab]);

  const [queue, setQueue] = useState<DueWord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState<ReviewRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const prefs = usePreferences();

  const [reinforcing, setReinforcing] = useState(false);
  const [reinforceDone, setReinforceDone] = useState(false);
  const [counts, setCounts] = useState<Record<ReviewRating, number>>({
    Again: 0,
    Hard: 0,
    Good: 0,
    Easy: 0
  });
  const doneTotalRef = useRef(0);
  const forgottenRef = useRef<DueWord[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);

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
    void load();
  }, [load, prefs.learningLang]);

  useEffect(() => {
    if (subTab !== "queue" || !prefs.autoSpeakReview) return;
    const word = queue[index];
    if (!word?.lemma) return;
    speakEs(word.lemma);
  }, [subTab, prefs.autoSpeakReview, queue, index]);

  const handleGrade = useCallback(
    async (rating: ReviewRating) => {
      const word = queue[index];
      if (!word || grading) return;

      setGrading(rating);
      try {
        const result = await gradeReviewWord(word.id, rating);
        doneTotalRef.current += 1;
        setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));

        if (rating === "Again") {
          const list = forgottenRef.current;
          if (!list.some((item) => item.id === word.id)) list.push(word);
        }

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
    } catch {
      // 保持在小结页
    } finally {
      setAutoLoading(false);
    }
  }, [autoLoading]);

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

  const startReinforce = useCallback(() => {
    const list = forgottenRef.current;
    if (list.length === 0) return;
    setQueue([...list]);
    setIndex(0);
    setFlipped(false);
    setReinforcing(true);
  }, []);

  const advanceReinforce = useCallback(() => {
    if (index + 1 >= queue.length) {
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

  const renderQueueBody = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.loadingText}>正在取复习队列…</Text>
        </View>
      );
    }

    if (error && queue.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      );
    }

    const current = queue[index];
    if (!current) {
      const remaining = Math.max(0, totalDue - doneTotalRef.current);
      const forgottenCount = forgottenRef.current.length;
      const offerReinforce = !reinforcing && forgottenCount > 0 && !reinforceDone;
      const reinforceJustFinished = !reinforcing && reinforceDone && forgottenCount > 0;
      const totalGraded = counts.Again + counts.Hard + counts.Good + counts.Easy;

      return (
        <View style={styles.center}>
          <Text style={styles.doneEmoji}>{reinforceJustFinished ? "💪" : "🎉"}</Text>
          <Text style={styles.doneTitle}>
            {reinforceJustFinished ? "补练完了" : totalGraded > 0 ? "这批复习完了" : "暂无待复习词"}
          </Text>
          <Text style={styles.doneText}>
            {totalGraded > 0
              ? `刚才复习了 ${totalGraded} 张${remaining > 0 ? `，今日还剩 ${remaining} 张` : ""}`
              : "去看看视频或阅读文章，点选新词收藏就会进入复习队列。"}
          </Text>

          {totalGraded > 0 ? (
            <Text style={styles.distribution}>
              忘了 {counts.Again} · 困难 {counts.Hard} · 良好 {counts.Good} · 简单 {counts.Easy}
            </Text>
          ) : null}

          {offerReinforce ? (
            <>
              <Pressable onPress={startReinforce} style={styles.retry}>
                <Text style={styles.retryText}>再过一遍忘词 ({forgottenCount})</Text>
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
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>{totalGraded > 0 ? "再取一批" : "刷新队列"}</Text>
            </Pressable>
          )}

          {/* 任务流联动：复习完成后自然引导去口语练习造句 */}
          <Pressable
            onPress={() => router.push("/talk" as never)}
            style={({ pressed }) => [styles.bridgeCard, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.bridgeIconBox}>
              <AppIcon color={colors.indigo600} name="mic" size={16} />
            </View>
            <View style={styles.bridgeText}>
              <Text style={styles.bridgeTitle}>去口语里用一用</Text>
              <Text style={styles.bridgeDesc}>和 AI 对话把刚记住的词说出来</Text>
            </View>
            <AppIcon color={colors.textTertiary} name="chevron" size={14} />
          </Pressable>
        </View>
      );
    }

    const meanings = current.dictData?.meanings ?? [];
    const examples = current.dictData?.examples ?? [];

    return (
      <>
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
          <View style={styles.card}>
            <View style={styles.cardHead}>
              {current.partOfSpeech ? (
                <Text style={styles.pos}>{current.partOfSpeech}</Text>
              ) : <View />}
              <Pressable onPress={() => speakEs(current.lemma)} hitSlop={8}>
                <AppIcon color={colors.brand600} name="speak" size={20} />
              </Pressable>
            </View>

            <Text style={styles.lemma}>{current.lemma}</Text>

            {!flipped ? (
              <Pressable
                onPress={() => setFlipped(true)}
                style={styles.revealButton}
              >
                <Text style={styles.revealText}>想不起来？查看释义</Text>
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
                  <Pressable onPress={advanceReinforce} style={styles.reinforceButton}>
                    <Text style={styles.ratingText}>
                      {index + 1 >= queue.length ? "记住了,收工" : "记住了,下一个"}
                    </Text>
                  </Pressable>
                ) : (
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
              ? "补练只重看一遍，不影响复习计划"
              : flipped
                ? "凭诚实评分：想不起来就点「忘了」，间隔会自动缩短"
                : "先自己想意思，再翻面"}
          </Text>
        </ScrollView>

        <Pressable onPress={() => void load(true)} style={styles.refreshLink}>
          <Text style={styles.refreshText}>↻ 重新取队列</Text>
        </Pressable>
        {refreshing ? <ActivityIndicator style={styles.refreshSpin} color={colors.brand500} /> : null}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.tabHeader}>
        <Text style={styles.eyebrow}>Repaso</Text>
        <Text style={styles.pageTitle}>复习与词库</Text>
        <View style={styles.segWrap}>
          <SegmentedControl
            onChange={setSubTab}
            options={[
              { key: "queue", label: "今日复习", badge: totalDue > 0 ? totalDue : undefined },
              { key: "vocab", label: "我的词库" },
              { key: "phrases", label: "短语搭配" }
            ]}
            value={subTab}
          />
        </View>
      </View>

      {subTab === "vocab" ? (
        <VocabListPanel />
      ) : subTab === "phrases" ? (
        <PhrasesListPanel />
      ) : (
        renderQueueBody()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  tabHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgSubtle
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  segWrap: { marginTop: spacing.md },
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
  doneText: { fontSize: 13.5, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  distribution: { fontSize: 12.5, color: colors.textTertiary },
  skipButton: { marginTop: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  skipText: { fontSize: 13, color: colors.textTertiary },
  autoSpin: { marginTop: spacing.md },
  bridgeCard: {
    marginTop: spacing.lg,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2
  },
  bridgeIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.indigo50,
    alignItems: "center",
    justifyContent: "center"
  },
  bridgeText: { flex: 1, gap: 2 },
  bridgeTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  bridgeDesc: { fontSize: 11.5, color: colors.textSecondary },
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
    paddingTop: spacing.sm
  },
  progressText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand700
  },
  dueText: { fontSize: 12, color: colors.textTertiary },
  body: {
    flexGrow: 1,
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
