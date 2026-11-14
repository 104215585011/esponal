// Timestamp: 2026-11-14 20:38
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

import { fetchGrammarTopic, type GrammarExample, type GrammarTopic } from "@/api/grammar";
import { LookupSheet } from "@/components/LookupSheet";
import { speakSpanish } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

/**
 * 语法详情。
 *
 * 结构直接照搬内容模型:类比 → 变位表 → 规则 → 例句 → ser/estar 对比 → 相关话题。
 * 例句里的西语可以点词查词(复用 LookupSheet),读到不会的词不用跳出去。
 */
export default function GrammarDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [topic, setTopic] = useState<GrammarTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookupContext, setLookupContext] = useState<string | undefined>(undefined);

  const openLookup = useCallback((word: string, context?: string) => {
    const clean = word.trim();
    if (!clean) return;
    setLookupContext(context);
    setLookupWord(clean);
  }, []);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      setTopic(await fetchGrammarTopic(String(slug)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "语法内容加载失败");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {topic?.title ?? "语法"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : error || !topic ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "没有找到这篇语法"}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.group}>{topic.group}</Text>
          <Text style={styles.title}>{topic.title}</Text>
          <Text style={styles.intro}>{topic.intro}</Text>

          <View style={styles.analogyCard}>
            <Text style={styles.analogyLabel}>换个说法</Text>
            <Text style={styles.analogyText}>{topic.analogy}</Text>
          </View>

          {topic.conjugations?.length ? (
            <Section title="变位表">
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  <Text style={[styles.th, styles.colPronoun]}>人称</Text>
                  <Text style={[styles.th, styles.colForm]}>形式</Text>
                  <Text style={styles.th}>说明</Text>
                </View>
                {topic.conjugations.map((row) => (
                  <Pressable
                    key={`${row.pronoun}-${row.form}`}
                    onPress={() => speakSpanish(row.audioLabel ?? row.form)}
                    style={({ pressed }) => [styles.tr, pressed && styles.trPressed]}
                  >
                    <Text style={[styles.td, styles.colPronoun, styles.pronoun]}>
                      {row.pronoun}
                    </Text>
                    <Text style={[styles.td, styles.colForm, styles.form]}>{row.form}</Text>
                    <Text style={[styles.td, styles.person]}>{row.person}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>点一行即可发音</Text>
            </Section>
          ) : null}

          {topic.rules?.length ? (
            <Section title="规则">
              {topic.rules.map((rule, index) => (
                <View key={rule} style={styles.ruleRow}>
                  <Text style={styles.ruleIndex}>{index + 1}</Text>
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {topic.examples?.length ? (
            <Section title="例句">
              {topic.examples.map((example) => (
                <ExampleBlock
                  example={example}
                  key={example.spanish}
                  onWord={openLookup}
                />
              ))}
            </Section>
          ) : null}

          {topic.comparison ? (
            <Section title="ser 与 estar 的对比">
              <Text style={styles.compareTitle}>ser</Text>
              {topic.comparison.ser.map((example) => (
                <ExampleBlock
                  example={example}
                  key={`ser-${example.spanish}`}
                  onWord={openLookup}
                />
              ))}
              <Text style={[styles.compareTitle, styles.compareTitleSpaced]}>estar</Text>
              {topic.comparison.estar.map((example) => (
                <ExampleBlock
                  example={example}
                  key={`estar-${example.spanish}`}
                  onWord={openLookup}
                />
              ))}
            </Section>
          ) : null}

          {topic.related?.length ? (
            <Section title="相关话题">
              <View style={styles.relatedRow}>
                {topic.related.map((item) => (
                  <Pressable
                    key={item.slug}
                    onPress={() => router.push(`/grammar/${item.slug}` as never)}
                    style={({ pressed }) => [styles.relatedChip, pressed && styles.chipPressed]}
                  >
                    <Text style={styles.relatedText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ExampleBlock({
  example,
  onWord
}: {
  example: GrammarExample;
  onWord: (word: string, context?: string) => void;
}) {
  // 按空白切词,保留标点原样显示;点哪个词就查哪个
  const words = example.spanish.split(/(\s+)/);

  return (
    <View style={styles.exampleCard}>
      <View style={styles.exampleHead}>
        <Text style={styles.exampleEs}>
          {words.map((chunk, index) =>
            /^\s+$/.test(chunk) || !chunk ? (
              <Text key={`sp-${index}`}>{chunk}</Text>
            ) : (
              <Text
                key={`w-${index}`}
                onPress={() =>
                  onWord(chunk.replace(/[^\p{L}\p{N}áéíóúüñÁÉÍÓÚÜÑ]/gu, ""), example.spanish)
                }
              >
                {chunk}{" "}
              </Text>
            )
          )}
        </Text>
        <Pressable hitSlop={8} onPress={() => speakSpanish(example.spanish)}>
          <Text style={styles.speak}>🔊</Text>
        </Pressable>
      </View>
      <Text style={styles.exampleZh}>{example.chinese}</Text>
      {example.reason ? <Text style={styles.exampleReason}>{example.reason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  body: { padding: spacing.lg, paddingBottom: 64 },
  group: { fontSize: 11.5, fontWeight: "700", color: colors.brand600, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 6 },
  intro: { fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: spacing.sm },
  analogyCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    gap: 4
  },
  analogyLabel: { fontSize: 11.5, fontWeight: "700", color: colors.brand700 },
  analogyText: { fontSize: 13.5, lineHeight: 21, color: colors.text },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  table: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10 },
  trPressed: { backgroundColor: colors.surfaceMuted },
  thead: { backgroundColor: colors.surfaceMuted },
  th: { fontSize: 11.5, fontWeight: "700", color: colors.textTertiary },
  td: { fontSize: 13.5, color: colors.text },
  colPronoun: { flex: 1.3 },
  colForm: { flex: 1 },
  pronoun: { color: colors.textSecondary },
  form: { fontWeight: "700" },
  person: { flex: 1.6, fontSize: 12, color: colors.textTertiary },
  hint: { fontSize: 11.5, color: colors.textTertiary },
  ruleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ruleIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    overflow: "hidden"
  },
  ruleText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.text },
  exampleCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6
  },
  exampleHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  exampleEs: { flex: 1, fontSize: 15, fontWeight: "600", lineHeight: 22, color: colors.text },
  speak: { fontSize: 15 },
  exampleZh: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  exampleReason: { fontSize: 12, lineHeight: 18, color: colors.textTertiary },
  compareTitle: { fontSize: 13, fontWeight: "800", color: colors.brand600 },
  compareTitleSpaced: { marginTop: spacing.sm },
  relatedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  relatedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipPressed: { backgroundColor: colors.surfaceMuted },
  relatedText: { fontSize: 12.5, fontWeight: "600", color: colors.brand600 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorText: { fontSize: 13.5, color: colors.textSecondary },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13.5, fontWeight: "700", color: "#fff" }
});
