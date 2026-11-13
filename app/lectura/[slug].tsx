// Timestamp: 2026-11-13 23:38
import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchStory(String(slug));
      setStory(data);
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
          <ParagraphBlock
            first={index === 0}
            key={index}
            onWordPress={(word) => {
              setLookupWord(word);
              setLookupContext(paragraph);
            }}
            text={paragraph}
          />
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
  }
});
