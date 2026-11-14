// Timestamp: 2026-11-13 23:38
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

import { fetchStories, fetchStory, markStoryRead, type LecturaStory } from "@/api/lectura";
import { LookupSheet } from "@/components/LookupSheet";
import { ParagraphBlock } from "@/components/ParagraphBlock";
import { useParagraphSpeech } from "@/hooks/useParagraphSpeech";
import { colors, radius, spacing } from "@/theme";

export default function LecturaReaderScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [story, setStory] = useState<LecturaStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  /** 下一篇(同难度优先),读完直接接着读 */
  const [nextSlug, setNextSlug] = useState<string | null>(null);

  const paragraphs = useMemo(() => story?.paragraphs ?? [], [story]);
  const speech = useParagraphSpeech(
    typeof slug === "string" ? slug : undefined,
    paragraphs.length
  );

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchStory(String(slug));
      setStory(data);
      // 打开即记为已读(失败静默,不打断阅读)
      void markStoryRead(String(slug));

      // 找同难度的下一篇:读完不用退回列表
      try {
        const all = await fetchStories();
        const sameLevel = all.filter((item) => item.level === data.level);
        const pos = sameLevel.findIndex((item) => item.slug === data.slug);
        const next = pos >= 0 ? sameLevel[pos + 1] : null;
        setNextSlug(next?.slug ?? null);
      } catch {
        setNextSlug(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.brand500} />
      </SafeAreaView>
    );
  }

  if (error || !story) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? "文章不存在"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButtonWide}>
          <Text style={styles.backButtonText}>返回</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {story.titleZh}
        </Text>
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
            {speech.playingIndex !== null ? "停止" : "朗读"}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badges}>
          <Text style={styles.levelBadge}>{story.level}</Text>
          <Text style={styles.metaText}>
            {story.durationMin} 分钟 · {story.paragraphs.length} 段
          </Text>
        </View>

        <Text style={styles.title}>{story.title}</Text>
        <Text style={styles.titleZh}>{story.titleZh}</Text>
        <Text style={styles.summary}>{story.summaryZh}</Text>

        <View style={styles.divider} />

        {story.paragraphs.map((paragraph, index) => (
          <View
            key={index}
            style={[
              styles.paraWrap,
              speech.playingIndex === index && styles.paraActive
            ]}
          >
            <View style={styles.paraRow}>
              {/* 单段朗读:精读时反复听某一段 */}
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (speech.playingIndex === index) speech.stop();
                  else speech.playParagraph(index);
                }}
                style={[
                  styles.paraPlay,
                  speech.playingIndex === index && styles.paraPlayOn
                ]}
              >
                <Text
                  style={[
                    styles.paraPlayIcon,
                    speech.playingIndex === index && styles.paraPlayIconOn
                  ]}
                >
                  {speech.playingIndex === index ? "■" : "▶"}
                </Text>
              </Pressable>

              <View style={styles.paraBody}>
                <ParagraphBlock
                  first={index === 0}
                  onWordPress={(word) => {
                    setLookupWord(word);
                    setLookupContext(paragraph);
                  }}
                  text={paragraph}
                />
              </View>
            </View>
          </View>
        ))}

        {story.glossary.length > 0 ? (
          <View style={styles.glossary}>
            <Pressable
              onPress={() => setGlossaryOpen((prev) => !prev)}
              style={styles.glossaryHead}
            >
              <Text style={styles.glossaryTitle}>生词表 · {story.glossary.length}</Text>
              <Text style={styles.glossaryToggle}>{glossaryOpen ? "收起" : "展开"}</Text>
            </Pressable>

            {glossaryOpen
              ? story.glossary.map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => {
                      setLookupWord(item.word.replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ]/g, ""));
                      setLookupContext(undefined);
                    }}
                    style={styles.glossaryRow}
                  >
                    <Text style={styles.glossaryWord}>{item.word}</Text>
                    <Text style={styles.glossaryNote}>{item.note}</Text>
                  </Pressable>
                ))
              : null}
          </View>
        ) : null}

        <Text style={styles.footnote}>点任意单词查词,长按可选择文字。</Text>

        {nextSlug ? (
          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/lectura/[slug]",
                params: { slug: nextSlug }
              } as never)
            }
            style={styles.nextButton}
          >
            <Text style={styles.nextText}>读下一篇 →</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.back()} style={styles.nextButton}>
            <Text style={styles.nextText}>返回列表</Text>
          </Pressable>
        )}
      </ScrollView>

      <LookupSheet
        context={lookupContext}
        onClose={() => setLookupWord(null)}
        word={lookupWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.bg
  },
  errorText: { fontSize: 14, color: colors.text, textAlign: "center" },
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  },
  backIcon: {
    marginTop: -3,
    fontSize: 26,
    lineHeight: 30,
    color: colors.text,
    fontWeight: "300"
  },
  topTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  listenButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  listenButtonOn: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  listenText: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  listenTextOn: { color: "#fff" },
  paraWrap: {
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    paddingLeft: spacing.md,
    marginLeft: -spacing.md,
    borderRadius: radius.sm
  },
  paraActive: {
    borderLeftColor: colors.brand500,
    backgroundColor: colors.brand50
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 60
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  levelBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  metaText: { fontSize: 11, color: colors.textTertiary },
  title: {
    marginTop: spacing.md,
    fontSize: 26,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text
  },
  titleZh: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary
  },
  summary: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textTertiary
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xl
  },
  glossary: {
    marginTop: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg
  },
  glossaryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  glossaryTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  glossaryToggle: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  glossaryRow: {
    marginTop: spacing.md,
    gap: 2
  },
  glossaryWord: { fontSize: 14, fontWeight: "700", color: colors.text },
  glossaryNote: { fontSize: 12.5, lineHeight: 20, color: colors.textSecondary },
  footnote: {
    marginTop: spacing.xxl,
    fontSize: 11.5,
    color: colors.textTertiary,
    textAlign: "center"
  },
  paraRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  paraBody: { flex: 1 },
  paraPlay: {
    marginTop: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  paraPlayOn: { backgroundColor: colors.brand500 },
  paraPlayIcon: { fontSize: 9, color: colors.textSecondary, marginLeft: 1 },
  paraPlayIconOn: { color: "#fff" },
  nextButton: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  nextText: { fontSize: 14, fontWeight: "700", color: colors.brand700 }
});
