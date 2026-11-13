// Timestamp: 2026-11-13 17:50
import { useCallback, useEffect, useState } from "react";
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

import { lookupWord, saveWord, type LookupResult } from "@/api/watch";
import { colors, radius, spacing } from "@/theme";

type LookupSheetProps = {
  word: string | null;
  context?: string;
  onClose: () => void;
};

export function LookupSheet({ word, context, onClose }: LookupSheetProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!word) {
      setData(null);
      setError(null);
      setSaved(false);
      setSavedHint(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);
    setSavedHint(null);

    lookupWord(word)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setSaved(Boolean(res.isSaved));
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

            {(data.meanings ?? []).map((meaning, index) => (
              <Text key={index} style={styles.meaning}>
                {index + 1}. {meaning}
              </Text>
            ))}

            {(data.examples ?? []).length > 0 ? (
              <View style={styles.examples}>
                <Text style={styles.sectionTitle}>例句</Text>
                {(data.examples ?? []).slice(0, 3).map((ex, index) => (
                  <View key={index} style={styles.example}>
                    <Text style={styles.exampleEs}>{ex.es}</Text>
                    <Text style={styles.exampleZh}>{ex.zh}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              disabled={saving || saved}
              onPress={handleSave}
              style={[
                styles.saveButton,
                saved && styles.saveButtonDone
              ]}
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
