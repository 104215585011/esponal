// Timestamp: 2026-11-15 07:00
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { PhrasesListPanel } from "@/components/PhrasesListPanel";
import { colors, spacing } from "@/theme";

/** 短语与搭配（独立入口，同时也在「复习 -> 短语搭配」展示） */
export default function PhrasesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>短语与搭配</Text>
        <View style={styles.backHit} />
      </View>

      <PhrasesListPanel />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  backHit: { width: 28, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text }
});
