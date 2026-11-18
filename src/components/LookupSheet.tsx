// Timestamp: 2026-11-15 08:06
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  lookupWord,
  savePhrase,
  saveWord,
  translateText,
  type LookupResult,
  type VerbConjugationPersons,
  type VerbConjugationsPayload
} from "@/api/watch";
import { colors, radius, spacing } from "@/theme";
import {
  getPreferences,
  LEARNING_LANGUAGE_OPTIONS,
  type LearningLanguage
} from "@/lib/preferences";
import { speakAuto } from "@/lib/speech";

type TenseKey =
  | "presente"
  | "preteritoIndefinido"
  | "preteritoImperfecto"
  | "preteritoPerfectoCompuesto"
  | "futuro"
  | "presenteSubjuntivo"
  | "condicional";

const VERB_TENSES: Array<{ key: TenseKey; label: string }> = [
  { key: "presente", label: "现在时" },
  { key: "preteritoIndefinido", label: "简单过去" },
  { key: "preteritoImperfecto", label: "未完成过去" },
  { key: "preteritoPerfectoCompuesto", label: "现在完成" },
  { key: "futuro", label: "将来时" },
  { key: "presenteSubjuntivo", label: "虚拟式" },
  { key: "condicional", label: "条件式" }
];

const PERSON_ROWS: Array<{ key: keyof VerbConjugationPersons; label: string }> = [
  { key: "yo", label: "yo" },
  { key: "tu", label: "tú" },
  { key: "el", label: "él / ella" },
  { key: "nosotros", label: "nosotros" },
  { key: "vosotros", label: "vosotros" },
  { key: "ellos", label: "ellos" }
];

// Timestamp: 2026-11-17 15:25
type LookupSheetProps = {
  word: string | null;
  context?: string;
  language?: LearningLanguage;
  sourceType?: "video" | "course" | "lectura" | "dissect" | "grammar" | "import" | "talk";
  sourceUrl?: string;
  onClose: () => void;
};

function langLabel(code?: string | null) {
  return LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === code)?.shortLabel ?? "目标语";
}

/**
 * 点词查词面板。
 *
 * 渲染服务端返回的全部字段:释义 / 词法讲解 / 用法 / 例句 / 相关词组 / 名词与形容词变位。
 * 支持在弹窗内即时切换查词与保存的目标语种（避免英文/法文词误入西语词库）。
 */
export function LookupSheet({
  word,
  context,
  language,
  sourceType = "lectura",
  sourceUrl = "app://mobile/lookup",
  onClose
}: LookupSheetProps) {
  const insets = useSafeAreaInsets();
  const [lookupLang, setLookupLang] = useState<LearningLanguage>(
    () => language ?? getPreferences().learningLang
  );
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phraseSaving, setPhraseSaving] = useState(false);
  const [phraseSaved, setPhraseSaved] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  /** 词典未收录时的机器翻译兜底(仅供参考) */
  const [mtMeaning, setMtMeaning] = useState<string | null>(null);
  const [activeTense, setActiveTense] = useState<TenseKey>("presente");

  useEffect(() => {
    if (word) {
      setLookupLang(language ?? getPreferences().learningLang);
    }
  }, [word, language]);

  useEffect(() => {
    if (!word) {
      setData(null);
      setError(null);
      setSaved(false);
      setPhraseSaved(false);
      setSavedHint(null);
      setMtMeaning(null);
      setActiveTense("presente");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);
    setPhraseSaved(false);
    setSavedHint(null);
    setActiveTense("presente");
    setMtMeaning(null);

    lookupWord(word, lookupLang, context)
      .then(async (res) => {
        if (cancelled) return;
        setData(res);
        setSaved(Boolean(res.isSaved));

        // 词典完全没内容(词库 + 外部词典都查不到)→ 退到机器翻译,别让用户看空白
        const empty =
          !(res.meanings ?? []).length &&
          !res.morphInfo?.trim() &&
          !res.usageNote?.trim() &&
          !(res.examples ?? []).length &&
          !(res.relatedPhrases ?? []).length &&
          !res.nounForms &&
          !res.adjectiveForms;

        if (empty) {
          const mt = await translateText(word, lookupLang);
          if (!cancelled) setMtMeaning(mt);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "查询失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [word, lookupLang, context]);

  const handleSave = useCallback(
    async (markAsKnown = false) => {
      if (!data || saving || saved) return;
      setSaving(true);
      setSavedHint(null);

      try {
        const resolvedTranslation =
          data.meanings?.[0]?.trim() ||
          mtMeaning?.trim() ||
          data.morphInfo?.trim() ||
          data.lemma;
        const resolvedSentence =
          context?.trim() ||
          data.examples?.[0]?.es?.trim() ||
          data.word ||
          data.lemma;

        await saveWord({
          word: data.word || word || data.lemma,
          lemma: data.lemma,
          status: markAsKnown ? "KNOWN" : undefined,
          translation: resolvedTranslation,
          context: resolvedSentence,
          form: data.word || word || data.lemma,
          sourceType,
          sourceUrl,
          originalSentence: resolvedSentence,
          translatedSentence: data.examples?.[0]?.zh?.trim() || resolvedTranslation,
          timestampSec: 0,
          language: lookupLang
        });
        setSaved(true);
        setSavedHint(
          markAsKnown
            ? `已标记为已掌握（记入${langLabel(lookupLang)}词库并跳过复习）`
            : `已加入${langLabel(lookupLang)}词库`
        );
      } catch (e) {
        setSavedHint(e instanceof Error ? e.message : "加入失败");
      } finally {
        setSaving(false);
      }
    },
    [data, saving, saved, context, lookupLang, mtMeaning, word, sourceType, sourceUrl]
  );

  const meanings = data?.meanings ?? [];
  const examples = data?.examples ?? [];
  const relatedPhrases = data?.relatedPhrases ?? [];

  /** 收藏整个词组/搭配:视频里遇到固定搭配时比存单词更有用 */
  const handleSavePhrase = useCallback(async () => {
    if (!data || phraseSaving) return;
    setPhraseSaving(true);
    setSavedHint(null);

    try {
      await savePhrase({
        lemma: data.lemma,
        kind: data.lemma.trim().includes(" ") ? "collocation" : "phrase",
        translationZh: data.meanings?.[0] ?? mtMeaning ?? null,
        explanationZh: data.usageNote || data.morphInfo || null,
        language: lookupLang,
        data: {
          meanings: data.meanings ?? [],
          examples: data.examples ?? [],
          phonetic: data.phonetic ?? null,
          source: context ? { sentence: context, type: "mobile" } : undefined
        }
      });
      setPhraseSaved(true);
      setSavedHint(`已收藏到${langLabel(lookupLang)}「短语与搭配」`);
    } catch (e) {
      setSavedHint(e instanceof Error ? e.message : "收藏失败");
    } finally {
      setPhraseSaving(false);
    }
  }, [data, phraseSaving, context, mtMeaning, lookupLang]);

  /** 名词/形容词变位拼成一行文字 */
  const formsLine = useMemo(() => {
    if (!data) return null;
    if (data.nounForms) {
      const g =
        data.nounForms.gender === "f"
          ? "阴性"
          : data.nounForms.gender === "n"
            ? "中性"
            : data.nounForms.gender === "mf"
              ? "阴阳同形"
              : "阳性";
      if (
        lookupLang === "de" ||
        lookupLang === "fr" ||
        /^(der|die|das|le|la)\s+/i.test(data.nounForms.singular) ||
        /^l[’']/i.test(data.nounForms.singular)
      ) {
        return `${data.nounForms.singular} → ${data.nounForms.plural} · ${g}`;
      }
      return `单数 ${data.nounForms.singular} · 复数 ${data.nounForms.plural} · ${g}`;
    }
    if (data.adjectiveForms) {
      const f = data.adjectiveForms;
      return `阳性 ${f.ms} · 阴性 ${f.fs} · 复数 ${f.mp}/${f.fp}`;
    }
    return null;
  }, [data, lookupLang]);

  /** 有没有任何可展示的内容(决定是否显示空态提示) */
  const hasContent = useMemo(() => {
    if (!data) return false;
    return (
      meanings.length > 0 ||
      Boolean(data.morphInfo?.trim()) ||
      Boolean(data.usageNote?.trim()) ||
      examples.length > 0 ||
      relatedPhrases.length > 0 ||
      Boolean(formsLine)
    );
  }, [data, meanings, examples, relatedPhrases, formsLine]);

  /** 词典没内容但机器翻译拿到了 → 也算有内容 */
  const showMtFallback = !hasContent && Boolean(mtMeaning?.trim());

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={Boolean(word)}
    >
      <Pressable onPress={onClose} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />

        <View style={styles.langPillRow}>
          {LEARNING_LANGUAGE_OPTIONS.map((opt) => {
            const active = lookupLang === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setLookupLang(opt.value)}
                style={[styles.langPill, active && styles.langPillActive]}
              >
                <Text style={[styles.langPillText, active && styles.langPillTextActive]}>
                  {opt.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : data ? (
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {data.detectedLanguage && data.detectedLanguage !== lookupLang ? (
              <Pressable
                onPress={() => {
                  const target = LEARNING_LANGUAGE_OPTIONS.find(
                    (o) => o.value === data.detectedLanguage
                  )?.value;
                  if (target) setLookupLang(target);
                }}
                style={styles.langWarnBanner}
              >
                <Text style={styles.langWarnText}>
                  检测到更像{langLabel(data.detectedLanguage)}词，点此改查并存入{langLabel(data.detectedLanguage)}词库，避免混入{langLabel(lookupLang)}库 →
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.headRow}>
              <Text style={styles.lemma}>{data.lemma}</Text>
              {data.phonetic ? <Text style={styles.phonetic}>{data.phonetic}</Text> : null}
              <Pressable
                hitSlop={10}
                onPress={() => {
                  const opt = LEARNING_LANGUAGE_OPTIONS.find((o) => o.value === lookupLang);
                  speakAuto(data.lemma, { fallbackLang: opt?.ttsLang ?? lookupLang });
                }}
                style={styles.speakButton}
              >
                <Text style={styles.speakIcon}>🔊</Text>
              </Pressable>
            </View>

            {data.partOfSpeech ? (
              <Text style={styles.pos}>{data.partOfSpeech}</Text>
            ) : null}

            {meanings.length > 0 ? (
              meanings.map((meaning, index) => (
                <Text key={index} style={styles.meaning}>
                  {meanings.length > 1 ? `${index + 1}. ${meaning}` : meaning}
                </Text>
              ))
            ) : null}

            {/* 词法讲解:meanings 为空时的主要兜底内容 */}
            {data.morphInfo?.trim() ? (
              <Text style={styles.meaning}>{data.morphInfo.trim()}</Text>
            ) : null}

            {data.articleCue ? (
              <View style={styles.articleBox}>
                <Text style={styles.articleText}>
                  名词冠词：{data.articleCue.singularWithArticle}
                  {data.articleCue.pluralWithArticle ? ` → ${data.articleCue.pluralWithArticle}` : ""}
                  {`（${data.articleCue.genderLabel}）`}
                </Text>
              </View>
            ) : null}

            {data.cognateHint ? (
              <View
                style={[
                  styles.cognateBox,
                  data.cognateHint.isFalseFriend && styles.falseFriendBox
                ]}
              >
                <Text
                  style={[
                    styles.cognateText,
                    data.cognateHint.isFalseFriend && styles.falseFriendText
                  ]}
                >
                  {data.cognateHint.patternLabel} · {data.cognateHint.tipZh}
                </Text>
              </View>
            ) : null}

            {formsLine ? <Text style={styles.formsLine}>{formsLine}</Text> : null}

            {data.conjugations ? (
              <VerbConjugationSection
                activeTense={activeTense}
                conjugations={data.conjugations}
                onSelectTense={setActiveTense}
              />
            ) : null}

            {data.usageNote?.trim() ? (
              <View style={styles.usageBox}>
                <Text style={styles.usageTitle}>用法</Text>
                <Text style={styles.usageText}>{data.usageNote.trim()}</Text>
              </View>
            ) : null}

            {examples.length > 0 ? (
              <View style={styles.examples}>
                <Text style={styles.sectionTitle}>例句</Text>
                {examples.slice(0, 3).map((ex, index) => (
                  <View key={index} style={styles.example}>
                    <Text style={styles.exampleEs}>{ex.es}</Text>
                    <Text style={styles.exampleZh}>{ex.zh}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {relatedPhrases.length > 0 ? (
              <View style={styles.examples}>
                <Text style={styles.sectionTitle}>相关词组</Text>
                {relatedPhrases.slice(0, 4).map((phrase, index) => (
                  <Text key={index} style={styles.exampleEs}>
                    {phrase.lemma}
                    {phrase.translationZh ? ` —— ${phrase.translationZh}` : ""}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* 词典未收录 → 机器翻译兜底 */}
            {showMtFallback ? (
              <View style={styles.usageBox}>
                <Text style={styles.usageTitle}>机器翻译 · 词典未收录</Text>
                <Text style={styles.usageText}>{mtMeaning?.trim()}</Text>
              </View>
            ) : null}

            {/* 完全没有内容时的兜底提示,别让用户对着空白按钮发呆 */}
            {!hasContent && !showMtFallback ? (
              <Text style={styles.emptyHint}>
                词典里暂时没有「{data.lemma}」的释义,可以先把单词存入词库。
              </Text>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                disabled={saving || saved}
                onPress={() => void handleSave(false)}
                style={[styles.saveButton, styles.actionFlex, saved && styles.saveButtonDone]}
              >
                <Text style={[styles.saveButtonText, saved && styles.saveButtonTextDone]}>
                  {saved
                    ? `已在${langLabel(lookupLang)}词库`
                    : saving
                      ? "加入中…"
                      : `存入${langLabel(lookupLang)}词库`}
                </Text>
              </Pressable>

              <Pressable
                disabled={phraseSaving || phraseSaved}
                onPress={handleSavePhrase}
                style={[
                  styles.phraseButton,
                  styles.actionFlex,
                  phraseSaved && styles.saveButtonDone
                ]}
              >
                <Text
                  style={[styles.phraseButtonText, phraseSaved && styles.saveButtonTextDone]}
                >
                  {phraseSaved ? "已收藏" : phraseSaving ? "收藏中…" : "收藏搭配"}
                </Text>
              </Pressable>
            </View>

            {data.cognateHint?.isCognate && !saved ? (
              <Pressable
                disabled={saving}
                onPress={() => void handleSave(true)}
                style={styles.knownQuickBtn}
              >
                <Text style={styles.knownQuickText}>同源秒懂 · 记入词库并跳过复习</Text>
              </Pressable>
            ) : null}

            {savedHint ? <Text style={styles.savedHint}>{savedHint}</Text> : null}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function VerbConjugationSection({
  conjugations,
  activeTense,
  onSelectTense
}: {
  conjugations: VerbConjugationsPayload;
  activeTense: TenseKey;
  onSelectTense: (tense: TenseKey) => void;
}) {
  const availableTenses = VERB_TENSES.filter((item) => Boolean(conjugations[item.key]));
  if (availableTenses.length === 0) return null;

  const currentKey = conjugations[activeTense] ? activeTense : availableTenses[0].key;
  const currentForms = conjugations[currentKey];
  if (!currentForms) return null;

  return (
    <View style={styles.conjBox}>
      <View style={styles.conjHeader}>
        <Text style={styles.conjTitle}>动词变位 · {conjugations.infinitive}</Text>
        {conjugations.participio || conjugations.gerundio ? (
          <Text style={styles.conjNonFinite}>
            {conjugations.gerundio ? `副动词 ${conjugations.gerundio}` : ""}
            {conjugations.gerundio && conjugations.participio ? " · " : ""}
            {conjugations.participio ? `过去分词 ${conjugations.participio}` : ""}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.tenseTabs}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {availableTenses.map((item) => {
          const active = item.key === currentKey;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelectTense(item.key)}
              style={[styles.tenseTab, active && styles.tenseTabActive]}
            >
              <Text style={[styles.tenseTabText, active && styles.tenseTabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.personGrid}>
        {PERSON_ROWS.map((row) => (
          <View key={row.key} style={styles.personCell}>
            <Text style={styles.personLabel}>{row.label}</Text>
            <Text style={styles.personValue}>{currentForms[row.key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: "72%"
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md
  },
  center: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  errorText: { fontSize: 13, color: colors.danger },
  body: { paddingBottom: spacing.lg, gap: 6 },
  headRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
    flexWrap: "wrap"
  },
  lemma: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text
  },
  phonetic: { fontSize: 13, color: colors.textTertiary },
  speakButton: {
    marginLeft: "auto",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  speakIcon: { fontSize: 16 },
  pos: {
    alignSelf: "flex-start",
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  meaning: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text
  },
  formsLine: {
    marginTop: 4,
    fontSize: 12.5,
    color: colors.textTertiary
  },
  conjBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    gap: spacing.sm
  },
  conjHeader: {
    gap: 2
  },
  conjTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary
  },
  conjNonFinite: {
    fontSize: 11.5,
    color: colors.textTertiary
  },
  tenseTabs: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2
  },
  tenseTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  tenseTabActive: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  tenseTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary
  },
  tenseTabTextActive: {
    color: "#fff"
  },
  personGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  personCell: {
    width: "48%",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  personLabel: {
    fontSize: 11,
    color: colors.textTertiary
  },
  personValue: {
    marginTop: 2,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.text
  },
  usageBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  usageTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginBottom: 4
  },
  usageText: { fontSize: 14, lineHeight: 22, color: colors.text },
  examples: { marginTop: spacing.lg, gap: spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textTertiary
  },
  example: { gap: 3 },
  exampleEs: { fontSize: 14, lineHeight: 22, color: colors.text },
  exampleZh: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  emptyHint: {
    marginTop: spacing.lg,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textTertiary,
    textAlign: "center"
  },
  saveButton: {
    marginTop: 0,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  actionRow: { marginTop: spacing.xl, flexDirection: "row", gap: spacing.sm },
  actionFlex: { flex: 1 },
  phraseButton: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg
  },
  phraseButtonText: { fontSize: 14.5, fontWeight: "700", color: colors.brand600 },
  saveButtonDone: {
    backgroundColor: colors.brand50
  },
  saveButtonText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  saveButtonTextDone: { color: colors.brand700 },
  savedHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center"
  },
  langPillRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: spacing.sm
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  langPillActive: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand500
  },
  langPillText: { fontSize: 11.5, fontWeight: "700", color: colors.textTertiary },
  langPillTextActive: { color: colors.brand700 },
  langWarnBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs
  },
  langWarnText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#92400E"
  },
  articleBox: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.brand100,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  articleText: { fontSize: 12.5, fontWeight: "700", color: colors.brand700 },
  cognateBox: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.indigo50,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  cognateText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: colors.indigo600 },
  falseFriendBox: { backgroundColor: colors.amber50 },
  falseFriendText: { color: colors.amber700 },
  knownQuickBtn: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.indigo50,
    backgroundColor: colors.indigo50,
    alignItems: "center"
  },
  knownQuickText: { fontSize: 12.5, fontWeight: "700", color: colors.indigo600 }
});
