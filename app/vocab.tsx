// Timestamp: 2026-11-15 07:00
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { VocabListPanel } from "@/components/VocabListPanel";
import { colors, spacing } from "@/theme";

/** 我的词库（独立入口，同时也在「复习 -> 我的词库」展示） */
export default function VocabScreen() {
  const router = useRouter();
  const [total, setTotal] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>我的词库</Text>
        <Text style={styles.headerCount}>{total ?? ""}</Text>
      </View>

      <VocabListPanel onTotalChange={setTotal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  backHit: { width: 28, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  headerCount: { fontSize: 12.5, fontWeight: "700", color: colors.textTertiary }
});
