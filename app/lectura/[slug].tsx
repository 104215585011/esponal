// Timestamp: 2026-11-18 11:26
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  completeLecturaStory,
  fetchStory,
  reportLecturaProgress,
  translateParagraphs,
  type LecturaNextRecommendation,
  type LecturaStory
} from "@/api/lectura";
import { getProxiedCoverUrl } from "@/api/podcasts";
// Timestamp: 2026-11-17 23:12
import { getPreferences, normalizeSupportedLang, type LearningLanguage } from "@/lib/preferences";
import { LookupSheet } from "@/components/LookupSheet";
import { ParagraphBlock } from "@/components/ParagraphBlock";
import { useParagraphSpeech } from "@/hooks/useParagraphSpeech";
import { colors, radius, spacing } from "@/theme";

type DisplayMode = "bilingual" | "target" | "zh";
type PaperTheme = "white" | "warm" | "night";

const PAPER_STYLES: Record<
  PaperTheme,
  { label: string; bg: string; card: string; text: string; sub: string; border: string }
> = {
  white: {
    label: "白",
    bg: "#FFFFFF",
    card: "#F8FAFC",
    text: "#0F172A",
    sub: "#475569",
    border: "#E2E8F0"
  },
  warm: {
    label: "暖",
    bg: "#FBF6EA",
    card: "#F5ECD7",
    text: "#3F3526",
    sub: "#6E5F47",
    border: "#E7DABF"
  },
  night: {
    label: "夜",
    bg: "#13161B",
    card: "#1D222A",
    text: "#E5E7EB",
    sub: "#9CA3AF",
    border: "#2D333D"
  }
};

const FONT_SIZES = [16, 18, 21] as const;

/**
 * 短文精读阅读器（重构版）：
 * - 全幅舒适书页排版，去掉挤占正文的左侧圆形按钮
 * - 默认开启「中西对照」（整篇段落自动翻译并带服务端 Redis 缓存）
 * - 支持「中西对照 / 纯西语 / 纯中文」即时切换、字号与护眼底色调节、单段/整篇朗读与点词查变位
 */
export default function LecturaReaderScreen() {
  const { slug, lang, p } = useLocalSearchParams<{ slug: string; lang?: string; p?: string }>();
  const router = useRouter();

  const [story, setStory] = useState<LecturaStory | null>(null);
  const materialLang: LearningLanguage =
    story?.language ??
    normalizeSupportedLang(typeof lang === "string" ? lang : undefined) ??
    getPreferences().learningLang;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [nextRec, setNextRec] = useState<LecturaNextRecommendation | null>(null);

  const [displayMode, setDisplayMode] = useState<DisplayMode>("bilingual");
  const [paper, setPaper] = useState<PaperTheme>("warm");
  const [fontSizeIdx, setFontSizeIdx] = useState<number>(1);
  const [translations, setTranslations] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);

  const scrollViewRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const paraYRef = useRef<Record<number, number>>({});
  const restoredScrollRef = useRef(false);
  const lastReportedParaRef = useRef(-1);

  const paragraphs = useMemo(() => story?.paragraphs ?? [], [story]);
  const speech = useParagraphSpeech(
    typeof slug === "string" ? slug : undefined,
    paragraphs,
    materialLang
  );

  const theme = PAPER_STYLES[paper];
  const fontSize = FONT_SIZES[fontSizeIdx] ?? 18;

  const targetResumeIndex = useMemo(() => {
    const parsed = typeof p === "string" ? Number.parseInt(p, 10) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const saved = story?.lastParagraphIndex ?? 0;
    return saved > 0 ? saved : 0;
  }, [p, story?.lastParagraphIndex]);

  const persistProgress = useCallback(
    (paragraphIndex: number) => {
      if (!story || completed) return;
      if (paragraphIndex <= lastReportedParaRef.current) return;
      lastReportedParaRef.current = paragraphIndex;
      void reportLecturaProgress(story.slug, paragraphIndex, story.paragraphs.length);
    },
    [completed, story]
  );

  useEffect(() => {
    if (speech.playingIndex !== null) {
      persistProgress(speech.playingIndex);
    }
  }, [persistProgress, speech.playingIndex]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setTranslations([]);
    paraYRef.current = {};
    restoredScrollRef.current = false;
    lastReportedParaRef.current = -1;

    try {
      const data = await fetchStory(String(slug));
      setStory(data);
      setCompleted(Boolean(data.completed ?? data.isRead));
      setNextRec(data.nextRecommendation ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // 自动拉取当前文章全部段落的双语对照译文（始终按文章自身语种）
  useEffect(() => {
    if (!story || story.paragraphs.length === 0 || displayMode === "target") return;
    if (translations.length > 0) return;

    let cancelled = false;
    setTranslating(true);
    translateParagraphs(story.paragraphs, materialLang)
      .then((list) => {
        if (!cancelled) setTranslations(list);
      })
      .catch(() => {
        // 翻译接口暂时不可用时静默保留原文
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [story, displayMode, translations.length, materialLang]);

  const handleMarkCompleted = async () => {
    if (!story || completing) return;
    setCompleting(true);
    const res = await completeLecturaStory(story.slug, story.paragraphs.length);
    setCompleting(false);
    if (res.ok) {
      setCompleted(true);
      if (res.nextRecommendation) {
        setNextRec(res.nextRecommendation);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={colors.brand500} />
      </SafeAreaView>
    );
  }

  if (error || !story) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>{error ?? "文章不存在"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButtonWide}>
          <Text style={styles.backButtonText}>返回</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={["top"]}>
      {/* 顶栏 */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.bg, borderBottomColor: theme.border }
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Text style={[styles.backIcon, { color: theme.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
          {story.titleZh}
        </Text>
        <Pressable
          onPress={() => {
            if (story.audioUrl) {
              router.push({
                pathname: "/listening/podcast",
                params: {
                  title: story.title,
                  showTitle: story.source,
                  level: story.level ?? "A2",
                  audioUrl: story.audioUrl,
                  description: story.paragraphs.join("\n\n") || story.summaryZh,
                  language: materialLang
                }
              } as never);
              return;
            }
            router.push({ pathname: "/listening/[slug]", params: { slug: story.slug } } as never);
          }}
          style={styles.blindButton}
        >
          <Text style={styles.blindText}>{story.audioUrl ? "🎧 精听" : "🎧 盲听"}</Text>
        </Pressable>
        <Pressable
          onPress={speech.togglePlayAll}
          style={[styles.listenButton, speech.playingIndex !== null && styles.listenButtonOn]}
        >
          <Text
            style={[
              styles.listenText,
              speech.playingIndex !== null && styles.listenTextOn
            ]}
          >
            {speech.playingIndex !== null ? "停止" : "全篇朗读"}
          </Text>
        </Pressable>
      </View>

      {/* 阅读偏好控制条：中西对照 / 纯西语 / 纯中文 + 字号 + 纸张背景 */}
      <View
        style={[
          styles.controlBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border }
        ]}
      >
        <View style={styles.modeGroup}>
          {(
            [
              { key: "bilingual", label: "中西对照" },
              { key: "target", label: "纯西语" },
              { key: "zh", label: "纯中文" }
            ] as const
          ).map((mode) => {
            const active = displayMode === mode.key;
            return (
              <Pressable
                key={mode.key}
                onPress={() => setDisplayMode(mode.key)}
                style={[styles.modePill, active && styles.modePillOn]}
              >
                <Text style={[styles.modePillText, active && styles.modePillTextOn]}>
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.appearanceGroup}>
          <Pressable
            onPress={() => setFontSizeIdx((prev) => (prev + 1) % FONT_SIZES.length)}
            style={styles.smallPill}
          >
            <Text style={[styles.smallPillText, { color: theme.text }]}>字号 {fontSize}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const order: PaperTheme[] = ["warm", "white", "night"];
              const next = order[(order.indexOf(paper) + 1) % order.length];
              setPaper(next);
            }}
            style={styles.smallPill}
          >
            <Text style={[styles.smallPillText, { color: theme.text }]}>
              {theme.label}底
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badges}>
          <Text style={styles.levelBadge}>{story.level ?? "难度待确认"}</Text>
          <Text style={[styles.metaText, { color: theme.sub }]}>
            {story.source} · {story.topic ? `${story.topic} · ` : ""}约 {story.durationMin} 分钟 ·{" "}
            {story.isFullText === false ? "节选" : "全文"} ·{" "}
            {story.audioType === "native" ? "🎧 原声" : "🔊 合成朗读"}
          </Text>
        </View>

        {targetResumeIndex > 0 ? (
          <View style={styles.resumeBanner}>
            <Text style={styles.resumeBannerText}>
              已定位到上次阅读的第 {targetResumeIndex + 1} 段
            </Text>
          </View>
        ) : null}

        {story.coverUrl ? (
          <Image
            resizeMode="cover"
            source={{ uri: getProxiedCoverUrl(story.coverUrl) ?? story.coverUrl }}
            style={styles.heroCover}
          />
        ) : null}

        <Text style={[styles.title, { color: theme.text }]}>{story.title}</Text>
        <Text style={[styles.titleZh, { color: theme.sub }]}>{story.titleZh}</Text>

        {story.audioUrl ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/listening/podcast",
                params: {
                  title: story.title,
                  showTitle: story.source,
                  level: story.level ?? "A2",
                  audioUrl: story.audioUrl,
                  description: story.paragraphs.join("\n\n") || story.summaryZh,
                  coverUrl: story.coverUrl ?? "",
                  language: materialLang
                }
              } as never)
            }
            style={styles.podcastCard}
          >
            <View style={styles.podcastCardBody}>
              <Text style={styles.podcastCardTitle}>🎧 打开博客原声 + 双语字幕</Text>
              <Text style={styles.podcastCardHint}>
                带进度拖拽、倍速、30s 循环与原声精听
              </Text>
            </View>
            <Text style={styles.podcastCardArrow}>›</Text>
          </Pressable>
        ) : null}

        {translating && displayMode !== "target" && translations.length === 0 ? (
          <View style={styles.translatingBanner}>
            <ActivityIndicator color={colors.brand600} size="small" />
            <Text style={styles.translatingText}>正在生成流畅中文对照译文…</Text>
          </View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {story.paragraphs.map((paragraph, index) => {
          const zh = translations[index];
          const isSpeaking = speech.playingIndex === index;
          return (
            <View
              key={index}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                paraYRef.current[index] = y;
                if (
                  targetResumeIndex > 0 &&
                  !restoredScrollRef.current &&
                  index === targetResumeIndex
                ) {
                  restoredScrollRef.current = true;
                  scrollViewRef.current?.scrollTo({
                    y: Math.max(0, y - 16),
                    animated: false
                  });
                }
              }}
              style={[
                styles.paraWrap,
                { borderBottomColor: theme.border },
                isSpeaking && styles.paraActive
              ]}
            >
              {displayMode !== "zh" ? (
                <ParagraphBlock
                  first
                  fontSize={fontSize}
                  language={materialLang}
                  onWordPress={(word) => {
                    persistProgress(index);
                    setLookupWord(word);
                    setLookupContext(paragraph);
                  }}
                  text={paragraph}
                  textColor={theme.text}
                />
              ) : null}

              {displayMode !== "target" && zh ? (
                <Text
                  style={[
                    styles.zhParagraph,
                    {
                      color: theme.sub,
                      fontSize: Math.max(14, fontSize - 2),
                      lineHeight: Math.round(Math.max(14, fontSize - 2) * 1.62)
                    }
                  ]}
                >
                  {zh}
                </Text>
              ) : null}

              <View style={styles.paraFooter}>
                <Text style={[styles.paraNum, { color: theme.sub }]}>§{index + 1}</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    if (isSpeaking) speech.stop();
                    else speech.playParagraph(index);
                  }}
                  style={[styles.paraPlayChip, isSpeaking && styles.paraPlayChipOn]}
                >
                  <Text style={[styles.paraPlayChipText, isSpeaking && styles.paraPlayChipTextOn]}>
                    {isSpeaking ? "■ 停止朗读" : "🔊 听本段"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {story.glossary.length > 0 ? (
          <View style={[styles.glossary, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={() => setGlossaryOpen((prev) => !prev)}
              style={styles.glossaryHead}
            >
              <Text style={[styles.glossaryTitle, { color: theme.text }]}>
                生词表 · {story.glossary.length}
              </Text>
              <Text style={styles.glossaryToggle}>{glossaryOpen ? "收起" : "展开"}</Text>
            </Pressable>

            {glossaryOpen
              ? story.glossary.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => {
                      const cleanTerm = item.word
                        .replace(/^(der|die|das)\s+/i, "")
                        .replace(/[^\wÄÖÜäöüßÁÉÍÓÚÜÑáéíóúüñ]/g, "");
                      setLookupWord(cleanTerm || item.word);
                      setLookupContext(undefined);
                    }}
                    style={[styles.glossaryRow, { borderTopColor: theme.border }]}
                  >
                    <Text style={[styles.glossaryWord, { color: theme.text }]}>{item.word}</Text>
                    <Text style={[styles.glossaryNote, { color: theme.sub }]}>{item.note}</Text>
                  </Pressable>
                ))
              : null}
          </View>
        ) : null}

        <Text style={[styles.footnote, { color: theme.sub }]}>
          轻触任意单词即可查词、看原句并加入对应语种词库。
        </Text>

        <View style={[styles.completionBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {!completed ? (
            <View style={styles.completionPrompt}>
              <Text style={[styles.completionTitle, { color: theme.text }]}>读到末尾了吗？</Text>
              <Text style={[styles.completionHint, { color: theme.sub }]}>
                点「读完了」保存阅读完成记录，并为你推荐相近难度、相关主题的下一篇。
              </Text>
              <Pressable
                disabled={completing}
                onPress={() => void handleMarkCompleted()}
                style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
              >
                <Text style={styles.completeBtnText}>
                  {completing ? "正在保存…" : "✓ 读完了"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.completedWrap}>
              <View style={styles.completedBadgeRow}>
                <Text style={styles.completedBadge}>✓ 本篇已读完</Text>
                <Pressable onPress={() => router.back()}>
                  <Text style={styles.backToListLink}>返回列表</Text>
                </Pressable>
              </View>

              {nextRec ? (
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: "/lectura/[slug]",
                      params: { slug: nextRec.slug, lang: materialLang }
                    } as never)
                  }
                  style={styles.nextRecCard}
                >
                  <Text style={styles.nextRecReason}>为你推荐下一篇 · {nextRec.reasonZh}</Text>
                  <Text style={styles.nextRecTitle}>{nextRec.titleZh}</Text>
                  <Text style={styles.nextRecSummary} numberOfLines={2}>
                    {nextRec.summaryZh}
                  </Text>
                  <Text style={styles.nextRecMeta}>
                    {nextRec.level ?? "难度待确认"} · {nextRec.topic} · 约 {nextRec.durationMin}{" "}
                    分钟 · {nextRec.sourceLabel}
                  </Text>
                  {nextRec.matchedWords.length > 0 ? (
                    <Text style={styles.nextRecWords}>
                      复现生词：{nextRec.matchedWords.join("、")}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <LookupSheet
        context={lookupContext}
        language={materialLang}
        onClose={() => setLookupWord(null)}
        sourceType="lectura"
        sourceUrl={`lectura://${String(slug)}`}
        word={lookupWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl
  },
  errorText: { fontSize: 14, textAlign: "center" },
  backButtonWide: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  backButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 26, lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 14.5, fontWeight: "700" },
  blindButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.indigo50
  },
  blindText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  listenButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50
  },
  listenButtonOn: { backgroundColor: colors.brand600 },
  listenText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  listenTextOn: { color: "#fff" },
  controlBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  modeGroup: { flexDirection: "row", gap: 6 },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.14)"
  },
  modePillOn: { backgroundColor: colors.brand600 },
  modePillText: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
  modePillTextOn: { color: "#fff" },
  appearanceGroup: { flexDirection: "row", gap: 6 },
  smallPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.14)"
  },
  smallPillText: { fontSize: 11, fontWeight: "600" },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: spacing.xl,
    paddingBottom: 70
  },
  badges: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  levelBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  metaText: { fontSize: 11.5, flex: 1 },
  heroCover: {
    marginTop: spacing.md,
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted
  },
  title: {
    marginTop: spacing.md,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  titleZh: { marginTop: 4, fontSize: 14 },
  podcastCard: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100
  },
  podcastCardBody: { flex: 1, gap: 3 },
  podcastCardTitle: { fontSize: 13.5, fontWeight: "700", color: colors.brand700 },
  podcastCardHint: { fontSize: 11.5, color: colors.textSecondary },
  podcastCardArrow: { fontSize: 20, fontWeight: "600", color: colors.brand600 },
  translatingBanner: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.brand50
  },
  translatingText: { fontSize: 12, fontWeight: "600", color: colors.brand700 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.lg
  },
  paraWrap: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10
  },
  paraActive: {
    backgroundColor: "rgba(16,185,129,0.08)",
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: radius.md
  },
  zhParagraph: {
    borderLeftWidth: 2,
    borderLeftColor: colors.brand500,
    paddingLeft: 10
  },
  paraFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  paraNum: { fontSize: 11, fontWeight: "600" },
  paraPlayChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.14)"
  },
  paraPlayChipOn: { backgroundColor: colors.brand600 },
  paraPlayChipText: { fontSize: 11.5, fontWeight: "600", color: colors.textSecondary },
  paraPlayChipTextOn: { color: "#fff" },
  glossary: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg
  },
  glossaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  glossaryTitle: { fontSize: 14, fontWeight: "700" },
  glossaryToggle: { fontSize: 12.5, fontWeight: "600", color: colors.brand600 },
  glossaryRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  glossaryWord: { fontSize: 14.5, fontWeight: "700" },
  glossaryNote: { marginTop: 2, fontSize: 13 },
  footnote: { marginTop: spacing.xl, fontSize: 12, textAlign: "center" },
  resumeBanner: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.indigo50,
    alignSelf: "flex-start"
  },
  resumeBannerText: { fontSize: 11.5, fontWeight: "700", color: colors.indigo600 },
  completionBox: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg
  },
  completionPrompt: { gap: 8 },
  completionTitle: { fontSize: 15, fontWeight: "800" },
  completionHint: { fontSize: 12.5, lineHeight: 19 },
  completeBtn: {
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500,
    alignItems: "center"
  },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { fontSize: 14.5, fontWeight: "800", color: "#fff" },
  completedWrap: { gap: 12 },
  completedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  completedBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  backToListLink: { fontSize: 12.5, fontWeight: "700", color: colors.brand600 },
  nextRecCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand100,
    backgroundColor: colors.brand50,
    padding: spacing.md,
    gap: 5
  },
  nextRecReason: { fontSize: 11.5, fontWeight: "700", color: colors.brand700 },
  nextRecTitle: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  nextRecSummary: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  nextRecMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  nextRecWords: { fontSize: 11.5, fontWeight: "700", color: colors.indigo600, marginTop: 2 }
});
