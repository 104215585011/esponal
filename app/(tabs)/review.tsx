// Timestamp: 2026-11-18 16:45
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
  markVocabStatus,
  type DueWord,
  type ReviewRating
} from "@/api/review";
import { AppIcon } from "@/components/AppIcon";
import { PhrasesListPanel } from "@/components/PhrasesListPanel";
import { SegmentedControl } from "@/components/SegmentedControl";
import { VocabListPanel } from "@/components/VocabListPanel";
import { usePreferences } from "@/hooks/usePreferences";
import {
  getPreferences,
  LEARNING_LANGUAGE_OPTIONS,
  type LearningLanguage
} from "@/lib/preferences";
import { speakAuto } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

type ReviewTab = "queue" | "vocab" | "phrases";
type ReviewMode = "context" | "cloze" | "audio";

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

const TALK_CHAR_BY_LANG: Record<LearningLanguage, string> = {
  es: "carlos",
  en: "emma",
  fr: "sophie",
  ja: "kenji",
  de: "carlos"
};

function speakEs(text: string) {
  const lang = getPreferences().learningLang;
  const opt = LEARNING_LANGUAGE_OPTIONS.find((o) => o.value === lang);
  speakAuto(text, { fallbackLang: opt?.ttsLang ?? lang });
}

/**
 * 复习与词库中心（升级版）：
 * - 单词与短语搭配（SavedPhrase）共用 FSRS 队列，优先高频词与重复遭遇词
 * - 支持三种练习模式：语境记忆（含名词冠词强化）、原句挖空（Cloze）、听音辨义
 * - 同源秒懂 / 屡忘低频词支持一键标熟跳过
 * - 复习结束携带本轮词汇直达语音 Robot 做造句输出闭环
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
  const [mode, setMode] = useState<ReviewMode>("context");
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
  const sessionTermsRef = useRef<string[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const reqSeqRef = useRef(0);
  const latestLangRef = useRef(prefs.learningLang);
  latestLangRef.current = prefs.learningLang;
  const activeLangMeta =
    LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === prefs.learningLang) ??
    LEARNING_LANGUAGE_OPTIONS[0];

  const load = useCallback(
    async (isRefresh = false) => {
      const seq = ++reqSeqRef.current;
      const reqLang = prefs.learningLang;
      if (isRefresh) setRefreshing(true);
      else {
        setLoading(true);
        setQueue([]);
        setTotalDue(0);
      }
      setError(null);

      try {
        const res = await fetchReviewQueue(undefined, reqLang);
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
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
          sessionTermsRef.current = [];
        }
      } catch (e) {
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [prefs.learningLang]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (subTab !== "queue") return;
    const word = queue[index];
    if (!word?.lemma) return;
    if (mode === "audio" && !flipped) {
      speakEs(word.cloze?.fullSentence || word.lemma);
      return;
    }
    if (prefs.autoSpeakReview) {
      speakEs(word.lemma);
    }
  }, [subTab, mode, flipped, prefs.autoSpeakReview, queue, index]);

  const handleGrade = useCallback(
    async (rating: ReviewRating) => {
      const word = queue[index];
      if (!word || grading) return;

      setGrading(rating);
      try {
        const result = await gradeReviewWord(word.id, rating, word.itemType ?? "word");
        doneTotalRef.current += 1;
        setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));

        if (!sessionTermsRef.current.includes(word.lemma)) {
          sessionTermsRef.current.push(word.lemma);
        }

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

  const handleQuickKnown = useCallback(async () => {
    const word = queue[index];
    if (!word || grading) return;
    setGrading("Easy");
    try {
      await markVocabStatus(word.id, "KNOWN", word.itemType ?? "word");
      doneTotalRef.current += 1;
      setLastFeedback("已标为掌握，移出今日队列");
      setTimeout(() => setLastFeedback(null), 2000);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setGrading(null);
    }
  }, [queue, index, grading]);

  const continueNextBatch = useCallback(async () => {
    if (autoLoading) return;
    const reqLang = prefs.learningLang;
    setAutoLoading(true);
    try {
      const res = await fetchReviewQueue(undefined, reqLang);
      if (reqLang !== latestLangRef.current) return;
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
  }, [autoLoading, prefs.learningLang]);

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
      const talkTargets = sessionTermsRef.current.slice(0, 5);
      const targetCharacterId = TALK_CHAR_BY_LANG[prefs.learningLang] ?? "carlos";

      return (
        <View style={styles.center}>
          <Text style={styles.doneEmoji}>{reinforceJustFinished ? "💪" : "🎉"}</Text>
          <Text style={styles.doneTitle}>
            {reinforceJustFinished ? "补练完了" : totalGraded > 0 ? "这批复习完了" : "暂无待复习词"}
          </Text>
          <Text style={styles.doneText}>
            {totalGraded > 0
              ? `刚才复习了 ${totalGraded} 张${remaining > 0 ? `，今日还剩 ${remaining} 张` : ""}`
              : "去看看视频、阅读文章或收藏常用语块，就会按高频优先进入队列。"}
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
                <Pressable onPress={() => setReinforceDone(true)} style={styles.skipButton}>
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

          {/* 任务流联动：带上刚复习过的词直达语音 Robot 进行真实造句输出 */}
          <Pressable
            onPress={() =>
              router.push(
                talkTargets.length > 0
                  ? ({
                      pathname: "/talk/[characterId]",
                      params: { characterId: targetCharacterId, words: talkTargets.join(",") }
                    } as never)
                  : ("/talk" as never)
              )
            }
            style={({ pressed }) => [styles.bridgeCard, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.bridgeIconBox}>
              <AppIcon color={colors.indigo600} name="mic" size={16} />
            </View>
            <View style={styles.bridgeText}>
              <Text style={styles.bridgeTitle}>
                {talkTargets.length > 0 ? "去口语里把这些词用出来" : "去口语里用一用"}
              </Text>
              <Text numberOfLines={1} style={styles.bridgeDesc}>
                {talkTargets.length > 0
                  ? `练习：${talkTargets.join(" · ")}`
                  : "和 AI 对话把刚记住的词说出来"}
              </Text>
            </View>
            <AppIcon color={colors.textTertiary} name="chevron" size={14} />
          </Pressable>
        </View>
      );
    }

    const meanings = current.dictData?.meanings ?? [];
    const examples = current.dictData?.examples ?? [];
    const nounForms = current.dictData?.nounForms;
    const encounters = current.encounters ?? [];
    const isPhrase = current.itemType === "phrase";
    const headline =
      current.encounterForm &&
      current.encounterForm.toLowerCase() !== current.lemma.toLowerCase()
        ? `${current.encounterForm}（${current.lemma}）`
        : current.articleCue?.maskedWithArticle ?? current.lemma;
    const canQuickKnown =
      Boolean(current.cognateHint?.isCognate) ||
      Boolean(current.isLowFrequency) ||
      (current.srsLapses ?? 0) >= 2;

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

        <View style={styles.modeRow}>
          {(
            [
              { key: "context", label: "语境记忆" },
              { key: "cloze", label: "原句挖空" },
              { key: "audio", label: "听音辨义" }
            ] as const
          ).map((item) => {
            const on = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMode(item.key);
                  setFlipped(false);
                }}
                style={[styles.modePill, on && styles.modePillOn]}
              >
                <Text style={[styles.modePillText, on && styles.modePillTextOn]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardBadgeGroup}>
                {isPhrase ? (
                  <Text style={styles.phraseTag}>{current.partOfSpeech ?? "实用语块"}</Text>
                ) : current.partOfSpeech ? (
                  <Text style={styles.pos}>{current.partOfSpeech}</Text>
                ) : null}
                {current.frequencyLevel ? (
                  <Text style={styles.freqTag}>{current.frequencyLevel}</Text>
                ) : null}
                {current.priorityReason ? (
                  <Text style={styles.reasonTag}>{current.priorityReason}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() =>
                  speakEs(
                    mode === "audio" && current.cloze?.fullSentence
                      ? current.cloze.fullSentence
                      : current.lemma
                  )
                }
                hitSlop={8}
              >
                <AppIcon color={colors.brand600} name="speak" size={20} />
              </Pressable>
            </View>

            {mode === "audio" && !flipped ? (
              <Pressable
                onPress={() => speakEs(current.cloze?.fullSentence || current.lemma)}
                style={styles.audioPromptBox}
              >
                <Text style={styles.audioPromptTitle}>🎧 点此再听一遍发音</Text>
                {current.cloze?.translatedSentence ? (
                  <Text style={styles.audioPromptSub}>
                    句意提示：{current.cloze.translatedSentence}
                  </Text>
                ) : (
                  <Text style={styles.audioPromptSub}>先听音辨认词义和冠词/变位，再翻面确认</Text>
                )}
              </Pressable>
            ) : mode === "cloze" && current.cloze ? (
              <View style={styles.clozeWrap}>
                <Text style={styles.clozeSentence}>{current.cloze.maskedSentence}</Text>
                {current.cloze.translatedSentence ? (
                  <Text style={styles.clozeHint}>{current.cloze.translatedSentence}</Text>
                ) : null}
              </View>
            ) : (
              <>
                <Text style={styles.lemma}>{headline}</Text>
                {current.articleCue ? (
                  <Text style={styles.articlePromptHint}>
                    先在心里想出冠词（{current.articleCue.genderLabel}）：el / la ?
                  </Text>
                ) : null}
                {encounters[0]?.originalSentence ? (
                  <View style={styles.encounterBox}>
                    <Text style={styles.encounterLabel}>
                      收藏原句
                      {(current.encounterCount ?? 1) > 1
                        ? ` · 累计遇到 ${current.encounterCount} 次`
                        : ""}
                    </Text>
                    <Text style={styles.encounterText}>{encounters[0].originalSentence}</Text>
                  </View>
                ) : null}
              </>
            )}

            {!flipped ? (
              <Pressable onPress={() => setFlipped(true)} style={styles.revealButton}>
                <Text style={styles.revealText}>想不起来？查看释义</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.divider} />

                {mode !== "context" ? (
                  <Text style={styles.revealedTarget}>
                    {current.cloze?.answerForm ?? current.lemma}
                    {current.cloze?.answerForm &&
                    current.cloze.answerForm.toLowerCase() !== current.lemma.toLowerCase()
                      ? `（原形 ${current.lemma}）`
                      : ""}
                  </Text>
                ) : null}

                {current.articleCue ? (
                  <Text style={styles.nounFormsLine}>
                    冠词绑定：{current.articleCue.singularWithArticle}
                    {current.articleCue.pluralWithArticle
                      ? ` → ${current.articleCue.pluralWithArticle}`
                      : ""}{" "}
                    ({current.articleCue.genderLabel})
                  </Text>
                ) : nounForms ? (
                  <Text style={styles.nounFormsLine}>
                    {nounForms.singular} → {nounForms.plural}
                  </Text>
                ) : null}

                {current.translation ? (
                  <Text style={styles.translation}>{current.translation}</Text>
                ) : null}

                {current.cognateHint ? (
                  <Text style={styles.cognateNote}>
                    {current.cognateHint.patternLabel} · {current.cognateHint.tipZh}
                  </Text>
                ) : null}

                {meanings.length > 0
                  ? meanings.slice(0, 3).map((m, i) => (
                      <Text key={i} style={styles.meaningLine}>
                        {i + 1}. {m}
                      </Text>
                    ))
                  : null}

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
                    : isPhrase
                      ? "首次复习这个语块"
                      : "第一次复习这个词"}
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

                {!reinforcing && canQuickKnown ? (
                  <Pressable
                    disabled={Boolean(grading)}
                    onPress={() => void handleQuickKnown()}
                    style={styles.knownSkipBtn}
                  >
                    <Text style={styles.knownSkipText}>
                      {current.cognateHint?.isCognate
                        ? "同源秒懂 · 标为已掌握"
                        : "低频先跳过 · 标为已掌握"}
                    </Text>
                  </Pressable>
                ) : null}

                {error ? <Text style={styles.gradeError}>{error}</Text> : null}
              </>
            )}
          </View>

          <Text style={styles.hint}>
            {reinforcing
              ? "补练只重看一遍，不影响复习计划"
              : flipped
                ? "凭诚实评分：想不起来就点「忘了」，间隔会自动缩短"
                : "先结合原句与冠词/变位回想，再翻面"}
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
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.eyebrow}>Repaso · {activeLangMeta.label}</Text>
            <Text style={styles.pageTitle}>复习与词库</Text>
          </View>
          <View style={styles.langPill}>
            <Text style={styles.langPillText}>{activeLangMeta.shortLabel}词库</Text>
          </View>
        </View>
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
  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  modePillOn: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  modePillText: { fontSize: 11.5, fontWeight: "600", color: colors.textSecondary },
  modePillTextOn: { color: "#fff" },
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
    justifyContent: "space-between",
    gap: 8
  },
  cardBadgeGroup: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6
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
  phraseTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.amber700,
    backgroundColor: colors.amber50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  freqTag: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  reasonTag: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textSecondary
  },
  audioPromptBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.indigo50,
    padding: spacing.lg,
    gap: 6
  },
  audioPromptTitle: { fontSize: 16, fontWeight: "800", color: colors.indigo600 },
  audioPromptSub: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  clozeWrap: { marginTop: spacing.lg, gap: 8 },
  clozeSentence: { fontSize: 20, fontWeight: "700", lineHeight: 30, color: colors.text },
  clozeHint: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  lemma: {
    marginTop: spacing.md,
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6
  },
  articlePromptHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand600
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
  revealedTarget: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand700
  },
  translation: {
    marginTop: spacing.md,
    fontSize: 19,
    fontWeight: "700",
    color: colors.text
  },
  cognateNote: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 18,
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm
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
  knownSkipBtn: {
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center"
  },
  knownSkipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
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
  refreshSpin: { position: "absolute", bottom: 40, alignSelf: "center" },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100
  },
  langPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand700
  },
  encounterBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4
  },
  encounterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand600
  },
  encounterText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text
  },
  nounFormsLine: {
    marginTop: spacing.xs,
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.brand700
  }
});
