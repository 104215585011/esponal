// Timestamp: 2026-11-14 12:35
import { useCallback, useEffect, useState } from "react";
import * as Speech from "expo-speech";
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

/** 西语发音(设备端 TTS,不花额度) */
function speakEs(text: string) {
  Speech.speak(text, { language: "es-ES", rate: 0.85 });
}

/**
 * 复习 tab:卡片式刷词。
 * 正面:单词 + 发音 → 翻面看释义 → 四档评分(FSRS 调度) → 下一张。
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
  const [doneCount, setDoneCount] = useState(0);

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
      setDoneCount(0);
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

  const handleGrade = useCallback(
    async (rating: ReviewRating) => {
      const word = queue[index];
      if (!word || grading) return;

      setGrading(rating);
      try {
        await gradeReviewWord(word.id, rating);
        setDoneCount((n) => n + 1);
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

  /** 刷完了:小结 + 剩余数量 */
  if (!current) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>这批复习完了</Text>
        <Text style={styles.doneText}>
          刚才复习了 {doneCount} 张{totalDue > 0 ? `,今日还剩 ${Math.max(0, totalDue - doneCount)} 张` : ""}
        </Text>
        <Pressable onPress={() => load()} style={styles.retry}>
          <Text style={styles.retryText}>再取一批</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const meanings = current.dictData?.meanings ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* 顶部进度 */}
      <View style={styles.topBar}>
        <Text style={styles.progressText}>
          {index + 1} / {queue.length}
        </Text>
        <Text style={styles.dueText}>今日待复习 {totalDue}</Text>
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

              {/* 四档评分:FSRS 调度下次复习时间 */}
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

              {error ? <Text style={styles.gradeError}>{error}</Text> : null}
            </>
          )}
        </View>

        <Text style={styles.hint}>
          {flipped
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
