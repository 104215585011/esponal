// Timestamp: 2026-11-14 04:00
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

import { lookupWord, saveWord, translateText, type LookupResult } from "@/api/watch";
import { colors, radius, spacing } from "@/theme";

type LookupSheetProps = {
  word: string | null;
  context?: string;
  onClose: () => void;
};

/**
 * 点词查词面板。
 *
 * 渲染服务端返回的全部字段:释义 / 词法讲解 / 用法 / 例句 / 相关词组 / 名词与形容词变位。
 * 词库条目可能只有 explanationZh(存进 morphInfo)而 meanings 为空 —— 必须有兜底,
 * 否则用户看到的就是一块空白 + 一个"加入词库"按钮。
 */
export function LookupSheet({ word, context, onClose }: LookupSheetProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  /** 词典未收录时的机器翻译兜底(仅供参考) */
  const [mtMeaning, setMtMeaning] = useState<string | null>(null);

  useEffect(() => {
    if (!word) {
      setData(null);
      setError(null);
      setSaved(false);
      setSavedHint(null);
      setMtMeaning(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);
    setSavedHint(null);
    setMtMeaning(null);

    lookupWord(word)
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
          const mt = await translateText(word);
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
  }, [word]);

  const handleSave = useCallback(async () => {
    if (!data || saving || saved) return;
    setSaving(true);
    setSavedHint(null);

    try {
      await saveWord({
        word: data.word,
        lemma: data.lemma,
        translation: data.meanings?.[0],
        context
      });
      setSaved(true);
      setSavedHint("已加入词库");
    } catch (e) {
      setSavedHint(e instanceof Error ? e.message : "加入失败");
    } finally {
      setSaving(false);
    }
  }, [data, saving, saved, context]);

  const meanings = data?.meanings ?? [];
  const examples = data?.examples ?? [];
  const relatedPhrases = data?.relatedPhrases ?? [];

  /** 名词/形容词变位拼成一行文字 */
  const formsLine = useMemo(() => {
    if (!data) return null;
    if (data.nounForms) {
      const g =
        data.nounForms.gender === "f"
          ? "阴性"
          : data.nounForms.gender === "mf"
            ? "阴阳同形"
            : "阳性";
      return `单数 ${data.nounForms.singular} · 复数 ${data.nounForms.plural} · ${g}`;
    }
    if (data.adjectiveForms) {
      const f = data.adjectiveForms;
      return `阳性 ${f.ms} · 阴性 ${f.fs} · 复数 ${f.mp}/${f.fp}`;
    }
    return null;
  }, [data]);

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
            <View style={styles.headRow}>
              <Text style={styles.lemma}>{data.lemma}</Text>
              {data.phonetic ? <Text style={styles.phonetic}>{data.phonetic}</Text> : null}
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

            {formsLine ? <Text style={styles.formsLine}>{formsLine}</Text> : null}

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

            <Pressable
              disabled={saving || saved}
              onPress={handleSave}
              style={[styles.saveButton, saved && styles.saveButtonDone]}
            >
              <Text style={[styles.saveButtonText, saved && styles.saveButtonTextDone]}>
                {saved ? "已在词库" : saving ? "加入中…" : "加入词库"}
              </Text>
            </Pressable>

            {savedHint ? <Text style={styles.savedHint}>{savedHint}</Text> : null}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
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
    marginTop: spacing.xl,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
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
  }
});
