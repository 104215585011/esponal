// Timestamp: 2026-11-15 03:28
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
import { useRouter } from "expo-router";

import { apiFetch } from "@/api/client";
import { speakSpanish } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

type PhonicsRule = {
  condition: string;
  sound: string;
  syllables: string[];
};

type AlphabetItem = {
  letter: string;
  letterLower: string;
  name: string;
  example: string;
  exampleZh: string;
  slug: string;
  rules: PhonicsRule[];
};

export default function PhonicsScreen() {
  const router = useRouter();
  const [letters, setLetters] = useState<AlphabetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ letters: AlphabetItem[] }>("/api/mobile/phonics");
      setLetters(res.letters ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.topTitle}>字母发音</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          27 个西班牙语字母与常见发音规则。点任意卡片听例词朗读。
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.list}>
            {letters.map((item) => {
              const expanded = expandedSlug === item.slug;
              return (
                <View key={item.slug} style={styles.card}>
                  <Pressable
                    onPress={() => void speakSpanish(item.example)}
                    style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
                  >
                    <View style={styles.letterBox}>
                      <Text style={styles.letterText}>
                        {item.letter} {item.letterLower}
                      </Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.letterName}>字母名：{item.name}</Text>
                      <Text style={styles.exampleText}>
                        {item.example} · {item.exampleZh}
                      </Text>
                    </View>
                    <Text style={styles.speakTag}>🔊 朗读</Text>
                  </Pressable>

                  {item.rules.length > 0 ? (
                    <View style={styles.ruleWrap}>
                      <Pressable
                        onPress={() => setExpandedSlug(expanded ? null : item.slug)}
                        style={styles.ruleToggle}
                      >
                        <Text style={styles.ruleToggleText}>
                          {expanded ? "收起发音规则 ▲" : `查看 ${item.rules.length} 条发音规则 ▼`}
                        </Text>
                      </Pressable>
                      {expanded
                        ? item.rules.map((rule, idx) => (
                            <View key={idx} style={styles.ruleItem}>
                              <Text style={styles.ruleCond}>{rule.condition}</Text>
                              <Text style={styles.ruleSound}>{rule.sound}</Text>
                              {rule.syllables.length > 0 ? (
                                <Text style={styles.ruleSyllables}>
                                  音节：{rule.syllables.join(" · ")}
                                </Text>
                              ) : null}
                            </View>
                          ))
                        : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  topBar: {
    height: 48,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg
  },
  backBtn: { minWidth: 56 },
  backText: { fontSize: 13.5, fontWeight: "600", color: colors.brand600 },
  topTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md },
  subtitle: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  center: { paddingVertical: 48, alignItems: "center" },
  errorText: { fontSize: 13, color: colors.danger },
  list: { gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: "hidden"
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  letterBox: {
    width: 54,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  letterText: { fontSize: 16, fontWeight: "800", color: colors.brand700 },
  cardMain: { flex: 1, gap: 2 },
  letterName: { fontSize: 12, color: colors.textTertiary },
  exampleText: { fontSize: 14, fontWeight: "600", color: colors.text },
  speakTag: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  ruleWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgSubtle
  },
  ruleToggle: { paddingVertical: 4 },
  ruleToggleText: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  ruleItem: { marginTop: 8, gap: 2 },
  ruleCond: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  ruleSound: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  ruleSyllables: { fontSize: 11.5, color: colors.textTertiary }
});
