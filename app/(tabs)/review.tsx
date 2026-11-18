// Timestamp: 2026-11-18 17:42
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
  fetchStarterPack,
  gradeReviewWord,
  markVocabStatus,
  saveStarterItem,
  type DueWord,
  type ReviewCounts,
  type ReviewQueueMode,
  type ReviewRating,
  type StarterHighFreqItem
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
type ReviewView = "hub" | "session" | "starter";
type PracticeMode = "context" | "cloze" | "audio";
type SessionKind = "recent" | "due" | "quick5";

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
 * 复习与词库中心（三入口版）：
 * 1. 「最近遇到」：回看今天/昨天收藏的词和语块（先看实际词形、原句与读音，点「遮住答案回想一次」后才按结果更新复习计划）
 * 2. 「到期复习」：按现有间隔复习计划回想以前学过的词，答完再安排下次时间
 * 3. 「练 5 分钟」：两边各取一点（2 条最近遇到 + 3 条到期，同一词去重只出一次）
 * 4. 「高频骨架词快扫」：先看中文、听读音、看短例句混个眼熟，不强迫一次死背
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

  const [reviewView, setReviewView] = useState<ReviewView>("hub");
  const [sessionKind, setSessionKind] = useState<SessionKind>("quick5");
  const [countsSummary, setCountsSummary] = useState<ReviewCounts>({
    recent: 0,
    due: 0,
    quick5: 0,
    unstartedNew: 0
  });
  const [queue, setQueue] = useState<DueWord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [recallActive, setRecallActive] = useState(true);
  const [mode, setMode] = useState<PracticeMode>("context");
  const [grading, setGrading] = useState<ReviewRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const prefs = usePreferences();

  const [starterItems, setStarterItems] = useState<StarterHighFreqItem[]>([]);
  const [starterIdx, setStarterIdx] = useState(0);
  const [starterMsg, setStarterMsg] = useState<string | null>(null);
  const [savingStarter, setSavingStarter] = useState(false);

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

  const loadOverview = useCallback(
    async (isRefresh = false) => {
      const seq = ++reqSeqRef.current;
      const reqLang = prefs.learningLang;
      if (isRefresh) setRefreshing(true);
      else {
        setLoading(true);
        setQueue([]);
        setReviewView("hub");
      }
      setError(null);

      try {
        const [revRes, starter] = await Promise.all([
          fetchReviewQueue(undefined, reqLang, "all"),
          fetchStarterPack(reqLang).catch(() => [])
        ]);
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setTotalDue(revRes.totalDue ?? 0);
        if (revRes.counts) {
          setCountsSummary(revRes.counts);
        } else {
          const n = revRes.dueWords?.length ?? 0;
          setCountsSummary({ recent: 0, due: n, quick5: Math.min(5, n), unstartedNew: 0 });
        }
        setStarterItems(starter);
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
    void loadOverview();
  }, [loadOverview]);

  const startSession = useCallback(
    async (chosen: SessionKind) => {
      const seq = ++reqSeqRef.current;
      const reqLang = prefs.learningLang;
      setSessionKind(chosen);
      setReviewView("session");
      setLoading(true);
      setError(null);
      setQueue([]);
      setIndex(0);
      setFlipped(false);
      setRecallActive(chosen !== "recent");
      setCounts({ Again: 0, Hard: 0, Good: 0, Easy: 0 });
      setReinforcing(false);
      setReinforceDone(false);
      doneTotalRef.current = 0;
      forgottenRef.current = [];
      sessionTermsRef.current = [];

      try {
        const res = await fetchReviewQueue(undefined, reqLang, chosen as ReviewQueueMode);
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setQueue(res.dueWords ?? []);
        setTotalDue(res.totalDue ?? 0);
        if (res.counts) setCountsSummary(res.counts);
      } catch (e) {
        if (seq !== reqSeqRef.current || reqLang !== latestLangRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (seq === reqSeqRef.current) setLoading(false);
      }
    },
    [prefs.learningLang]
  );

  useEffect(() => {
    if (subTab !== "queue" || reviewView !== "session") return;
    const word = queue[index];
    if (!word?.lemma) return;
    if (mode === "audio" && recallActive && !flipped) {
      speakEs(word.cloze?.fullSentence || word.lemma);
      return;
    }
    if (prefs.autoSpeakReview) {
      speakEs(word.encounters?.[0]?.originalSentence ? word.encounterForm || word.lemma : word.lemma);
    }
  }, [subTab, reviewView, mode, recallActive, flipped, prefs.autoSpeakReview, queue, index]);

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
        setRecallActive(sessionKind !== "recent");
        setIndex((i) => i + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "评分失败,请重试");
      } finally {
        setGrading(null);
      }
    },
    [queue, index, grading, sessionKind]
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
      setRecallActive(sessionKind !== "recent");
      setIndex((i) => i + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setGrading(null);
    }
  }, [queue, index, grading, sessionKind]);

  const continueNextBatch = useCallback(async () => {
    if (autoLoading || sessionKind === "quick5") return;
    const reqLang = prefs.learningLang;
    setAutoLoading(true);
    try {
      const res = await fetchReviewQueue(undefined, reqLang, sessionKind as ReviewQueueMode);
      if (reqLang !== latestLangRef.current) return;
      const next = res.dueWords ?? [];
      setTotalDue(res.totalDue ?? 0);
      if (next.length === 0) return;

      setQueue(next);
      setIndex(0);
      setFlipped(false);
      setRecallActive(sessionKind !== "recent");
    } catch {
      // 保持在小结页
    } finally {
      setAutoLoading(false);
    }
  }, [autoLoading, prefs.learningLang, sessionKind]);

  useEffect(() => {
    if (reviewView !== "session" || loading || autoLoading) return;
    if (queue.length > 0 && index < queue.length) return;
    if (reinforcing) return;
    if (forgottenRef.current.length > 0 && !reinforceDone) return;
    if (sessionKind === "quick5") return;
    if (totalDue - doneTotalRef.current <= 0) return;
    void continueNextBatch();
  }, [
    reviewView,
    queue,
    index,
    reinforcing,
    reinforceDone,
    loading,
    autoLoading,
    sessionKind,
    totalDue,
    continueNextBatch
  ]);

  const startReinforce = useCallback(() => {
    const list = forgottenRef.current;
    if (list.length === 0) return;
    setQueue([...list]);
    setIndex(0);
    setFlipped(false);
    setRecallActive(true);
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

  const handleSaveStarter = async (item: StarterHighFreqItem, status: "NEW" | "KNOWN") => {
    if (savingStarter) return;
    setSavingStarter(true);
    setStarterMsg(null);
    try {
      await saveStarterItem(item, status, prefs.learningLang);
      setStarterItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, inVocab: true, status } : x))
      );
      setStarterMsg(status === "KNOWN" ? "已标为早就认识" : "已加入待复习队列");
      setTimeout(() => {
        setStarterMsg(null);
        setStarterIdx((i) => i + 1);
      }, 350);
    } catch (e) {
      setStarterMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingStarter(false);
    }
  };

  const renderHub = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.loadingText}>正在整理你的学习入口…</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
        {/* 入口 1：练 5 分钟 */}
        <Pressable
          disabled={countsSummary.quick5 === 0}
          onPress={() => void startSession("quick5")}
          style={({ pressed }) => [
            styles.hubHeroCard,
            countsSummary.quick5 === 0 && styles.hubCardDisabled,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.hubCardTop}>
            <Text style={styles.hubHeroPill}>零碎时间首选 · 共 {countsSummary.quick5} 张</Text>
            <Text style={styles.hubActionArrow}>开始 ›</Text>
          </View>
          <Text style={styles.hubHeroTitle}>⚡ 练 5 分钟</Text>
          <Text style={styles.hubHeroDesc}>
            取 2 条「最近遇到」+ 3 条「到期复习」（同一个词只出一次），不够顺手补足 5 张，刷完即收工。
          </Text>
        </Pressable>

        {/* 入口 2 & 3：最近遇到 + 到期复习 */}
        <Pressable
          disabled={countsSummary.recent === 0}
          onPress={() => void startSession("recent")}
          style={({ pressed }) => [
            styles.hubCard,
            countsSummary.recent === 0 && styles.hubCardDisabled,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.hubCardTop}>
            <Text style={styles.hubRecentBadge}>今天 / 昨天收藏 · {countsSummary.recent} 条</Text>
            <Text style={styles.hubActionArrow}>回看 ›</Text>
          </View>
          <Text style={styles.hubTitle}>🕒 最近遇到</Text>
          <Text style={styles.hubDesc}>
            回看刚在视频或短文里收藏的词和语块（先看实际词形、原句和读音）。想记一记再点「遮住答案回想一次」，不把刚看过答案误当记住。
          </Text>
        </Pressable>

        <Pressable
          disabled={countsSummary.due === 0}
          onPress={() => void startSession("due")}
          style={({ pressed }) => [
            styles.hubCard,
            countsSummary.due === 0 && styles.hubCardDisabled,
            pressed && styles.pressed
          ]}
        >
          <View style={styles.hubCardTop}>
            <Text style={styles.hubDueBadge}>间隔计划 · {countsSummary.due} 条到期</Text>
            <Text style={styles.hubActionArrow}>回想 ›</Text>
          </View>
          <Text style={styles.hubTitle}>🗓️ 到期复习</Text>
          <Text style={styles.hubDesc}>
            按现有间隔复习计划回想以前学过的词，答完再安排下次时间。
          </Text>
        </Pressable>

        {/* 入口 4：起步高频骨架词扫盲 */}
        {starterItems.length > 0 ? (
          <Pressable
            onPress={() => {
              setStarterIdx(0);
              setStarterMsg(null);
              setReviewView("starter");
            }}
            style={({ pressed }) => [styles.hubStarterCard, pressed && styles.pressed]}
          >
            <View style={styles.hubCardTop}>
              <Text style={styles.hubStarterBadge}>高频骨架词 · {starterItems.length} 组</Text>
              <Text style={styles.hubActionArrow}>扫一遍 ›</Text>
            </View>
            <Text style={styles.hubTitle}>🌟 起步快扫（hay / puede / tiene que …）</Text>
            <Text style={styles.hubDesc}>
              不用死背：看看中文释义、听听读音、读一句短例句混个眼熟，以后读听材料自然熟起来。
            </Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.gradeError}>{error}</Text> : null}

        <Pressable onPress={() => void loadOverview(true)} style={styles.refreshLink}>
          <Text style={styles.refreshText}>{refreshing ? "正在刷新…" : "↻ 刷新各入口数量"}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderStarter = () => {
    const item = starterItems[starterIdx];
    return (
      <View style={styles.sessionWrap}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setReviewView("hub")} hitSlop={8}>
            <Text style={styles.backToHubText}>‹ 返回入口</Text>
          </Pressable>
          <Text style={styles.dueText}>
            {Math.min(starterIdx + 1, starterItems.length)} / {starterItems.length}
          </Text>
        </View>

        {!item ? (
          <View style={styles.center}>
            <Text style={styles.doneEmoji}>✨</Text>
            <Text style={styles.doneTitle}>高频骨架词扫完一轮啦</Text>
            <Text style={styles.doneText}>
              做到看到认识、听到有印象就够了。接下来去读一篇短文或看两条视频，马上就能撞见它们。
            </Text>
            <Pressable onPress={() => setReviewView("hub")} style={styles.retry}>
              <Text style={styles.retryText}>返回复习入口</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.phraseTag}>{item.posLabel}</Text>
                <Pressable onPress={() => speakEs(item.lemma)} hitSlop={8}>
                  <AppIcon color={colors.brand600} name="speak" size={20} />
                </Pressable>
              </View>

              <Text style={styles.lemma}>{item.displayForm}</Text>
              <Text style={styles.starterMeaning}>{item.translationZh}</Text>

              <View style={styles.encounterBox}>
                <View style={styles.starterExHead}>
                  <Text style={styles.encounterLabel}>短例句</Text>
                  <Pressable onPress={() => speakEs(item.exampleEs)} hitSlop={8}>
                    <Text style={styles.starterSpeakLink}>🔊 听例句</Text>
                  </Pressable>
                </View>
                <Text style={styles.encounterText}>{item.exampleEs}</Text>
                <Text style={styles.starterExZh}>{item.exampleZh}</Text>
              </View>

              <Text style={styles.starterNote}>{item.noteZh}</Text>

              {starterMsg ? <Text style={styles.starterStatusMsg}>{starterMsg}</Text> : null}

              <Pressable
                onPress={() => setStarterIdx((i) => i + 1)}
                style={styles.starterNextBtn}
              >
                <Text style={styles.ratingText}>混个眼熟了 · 下一个 →</Text>
              </Pressable>

              <View style={styles.starterSubRow}>
                <Pressable
                  disabled={savingStarter}
                  onPress={() => void handleSaveStarter(item, "NEW")}
                  style={styles.starterSubBtn}
                >
                  <Text style={styles.starterSubBtnText}>
                    {item.inVocab ? "已在词库" : "想重点记 · 加入队列"}
                  </Text>
                </Pressable>
                {item.kind === "word" ? (
                  <Pressable
                    disabled={savingStarter}
                    onPress={() => void handleSaveStarter(item, "KNOWN")}
                    style={styles.starterSubBtn}
                  >
                    <Text style={styles.starterSubBtnText}>早就会了</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  const renderSession = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.loadingText}>正在加载…</Text>
        </View>
      );
    }

    if (error && queue.length === 0) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void startSession(sessionKind)} style={styles.retry}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
          <Pressable onPress={() => setReviewView("hub")} style={styles.skipButton}>
            <Text style={styles.skipText}>返回入口</Text>
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
            {reinforceJustFinished
              ? "补练完了"
              : sessionKind === "quick5"
                ? "这 5 分钟练完啦"
                : sessionKind === "recent"
                  ? "最近遇到的过完一遍啦"
                  : "这批到期复习完成"}
          </Text>
          <Text style={styles.doneText}>
            {totalGraded > 0
              ? `本次完成 ${totalGraded} 次回想巩固${
                  sessionKind === "due" && remaining > 0 ? `，该计划还有 ${remaining} 条待回想` : ""
                }`
              : sessionKind === "recent"
                ? "已轻松过完刚才遇到的词，保持这份熟悉感就好。"
                : "暂时没有更多卡片了。"}
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
                  <Text style={styles.skipText}>跳过,先收工</Text>
                </Pressable>
              ) : null}
            </>
          ) : autoLoading ? (
            <ActivityIndicator color={colors.brand500} style={styles.autoSpin} />
          ) : (
            <Pressable
              onPress={() => {
                setReviewView("hub");
                void loadOverview(true);
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>返回复习入口</Text>
            </Pressable>
          )}

          {/* 任务流联动：带上刚练过的词直达语音 Robot 进行真实造句输出 */}
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
    const isBrowseFirstRecent = !recallActive;
    const headline =
      current.encounterForm &&
      current.encounterForm.toLowerCase() !== current.lemma.toLowerCase()
        ? `${current.encounterForm}（原形 ${current.lemma}）`
        : current.articleCue?.maskedWithArticle ?? current.lemma;
    const canQuickKnown =
      Boolean(current.cognateHint?.isCognate) ||
      Boolean(current.isLowFrequency) ||
      (current.srsLapses ?? 0) >= 2;
    const sessionLabel =
      sessionKind === "recent" ? "最近遇到" : sessionKind === "due" ? "到期复习" : "练 5 分钟";

    return (
      <>
        <View style={styles.topBar}>
          <View style={styles.topLeftGroup}>
            <Pressable
              onPress={() => {
                setReviewView("hub");
                void loadOverview(true);
              }}
              hitSlop={8}
            >
              <Text style={styles.backToHubText}>‹ 入口</Text>
            </Pressable>
            <Text style={styles.progressText}>
              {sessionLabel} · {index + 1}/{queue.length}
            </Text>
          </View>
          {reinforcing ? (
            <Text style={styles.feedback}>补练忘词 · 不计分</Text>
          ) : lastFeedback ? (
            <Text style={styles.feedback}>{lastFeedback}</Text>
          ) : isBrowseFirstRecent ? (
            <Text style={styles.browseTag}>轻松回看</Text>
          ) : null}
        </View>

        {recallActive ? (
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
        ) : null}

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardBadgeGroup}>
                {current.queueBucket === "recent" ? (
                  <Text style={styles.recentInlineTag}>最近遇到</Text>
                ) : null}
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
                    encounters[0]?.originalSentence ||
                      (mode === "audio" && current.cloze?.fullSentence) ||
                      current.lemma
                  )
                }
                hitSlop={8}
              >
                <AppIcon color={colors.brand600} name="speak" size={20} />
              </Pressable>
            </View>

            {isBrowseFirstRecent ? (
              <>
                <Text style={styles.lemma}>{current.encounterForm ?? current.lemma}</Text>
                {current.encounterForm &&
                current.encounterForm.toLowerCase() !== current.lemma.toLowerCase() ? (
                  <Text style={styles.lemmaSub}>词典原形：{current.lemma}</Text>
                ) : null}

                {encounters[0]?.originalSentence ? (
                  <View style={styles.encounterBox}>
                    <Text style={styles.encounterLabel}>刚才遇到的原句</Text>
                    <Text style={styles.encounterText}>{encounters[0].originalSentence}</Text>
                    {encounters[0].translatedSentence ? (
                      <Text style={styles.starterExZh}>{encounters[0].translatedSentence}</Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.divider} />

                {current.articleCue ? (
                  <Text style={styles.nounFormsLine}>
                    冠词绑定：{current.articleCue.singularWithArticle}
                    {current.articleCue.pluralWithArticle
                      ? ` → ${current.articleCue.pluralWithArticle}`
                      : ""}
                    {` (${current.articleCue.genderLabel})`}
                  </Text>
                ) : null}

                {current.translation ? (
                  <Text style={styles.translation}>{current.translation}</Text>
                ) : null}

                {meanings.slice(0, 2).map((m, i) => (
                  <Text key={i} style={styles.meaningLine}>
                    {i + 1}. {m}
                  </Text>
                ))}

                {current.cognateHint ? (
                  <Text style={styles.cognateNote}>
                    {current.cognateHint.patternLabel} · {current.cognateHint.tipZh}
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => {
                    setIndex((i) => i + 1);
                    setFlipped(false);
                    setRecallActive(false);
                  }}
                  style={styles.browseNextBtn}
                >
                  <Text style={styles.browseNextText}>过一遍，下一条 →</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setRecallActive(true);
                    setFlipped(false);
                  }}
                  style={styles.startRecallBtn}
                >
                  <Text style={styles.ratingText}>遮住答案 · 试着回想一次</Text>
                </Pressable>
              </>
            ) : (
              <>
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
                      <Text style={styles.audioPromptSub}>先听音辨认词义，再翻面确认</Text>
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
                        先心想冠词（{current.articleCue.genderLabel}）：el / la ?
                      </Text>
                    ) : null}
                    {encounters[0]?.originalSentence ? (
                      <View style={styles.encounterBox}>
                        <Text style={styles.encounterLabel}>收藏原句</Text>
                        <Text style={styles.encounterText}>{encounters[0].originalSentence}</Text>
                      </View>
                    ) : null}
                  </>
                )}

                {!flipped ? (
                  <Pressable onPress={() => setFlipped(true)} style={styles.revealButton}>
                    <Text style={styles.revealText}>查看答案</Text>
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
                          ? "首次安排语块复习"
                          : "首次回想，答完后自动安排下次间隔"}
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
              </>
            )}
          </View>

          <Text style={styles.hint}>
            {isBrowseFirstRecent
              ? "直接看一眼不会改动复习计划；只有点击「遮住答案回想一次」后评分才更新计划"
              : reinforcing
                ? "补练只重看一遍，不影响复习计划"
                : flipped
                  ? "凭诚实评分：想不起来就点「忘了」，间隔会自动缩短"
                  : "先自己试着回想，再查看答案"}
          </Text>
        </ScrollView>
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
              {
                key: "queue",
                label: "巩固练习",
                badge: countsSummary.quick5 > 0 ? countsSummary.quick5 : undefined
              },
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
      ) : reviewView === "starter" ? (
        renderStarter()
      ) : reviewView === "session" ? (
        renderSession()
      ) : (
        renderHub()
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
  hubScroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  hubHeroCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
    padding: spacing.lg,
    gap: 8
  },
  hubCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: 6
  },
  hubStarterCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: 6
  },
  hubCardDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  hubCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  hubHeroPill: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: colors.brand500,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  hubRecentBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  hubDueBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  hubStarterBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.amber700,
    backgroundColor: colors.amber50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  hubActionArrow: { fontSize: 13, fontWeight: "700", color: colors.brand600 },
  hubHeroTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 2 },
  hubHeroDesc: { fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  hubTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 2 },
  hubDesc: { fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  sessionWrap: { flex: 1 },
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
  topLeftGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  backToHubText: { fontSize: 13, fontWeight: "700", color: colors.brand600 },
  browseTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  progressText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textSecondary
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
  recentInlineTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.indigo600,
    backgroundColor: colors.indigo50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
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
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6
  },
  lemmaSub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textTertiary
  },
  articlePromptHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand600
  },
  browseNextBtn: {
    marginTop: spacing.xl,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center"
  },
  browseNextText: { fontSize: 14, fontWeight: "700", color: colors.text },
  startRecallBtn: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
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
  refreshLink: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.lg },
  refreshText: { fontSize: 12, color: colors.textTertiary },
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
  },
  starterMeaning: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: "700",
    color: colors.brand700
  },
  starterExHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  starterSpeakLink: { fontSize: 12, fontWeight: "700", color: colors.brand600 },
  starterExZh: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  starterNote: {
    marginTop: spacing.md,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary
  },
  starterStatusMsg: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand600
  },
  starterNextBtn: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  starterSubRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm
  },
  starterSubBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  starterSubBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary }
});
