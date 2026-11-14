// Timestamp: 2026-11-15 07:00
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ImportShelfPanel } from "@/components/ImportShelfPanel";
import { colors, spacing } from "@/theme";

/** 我的导入库（独立入口，同时也在「阅读 -> 我的书架」展示） */
export default function ImportsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>我的书架</Text>
        <View style={styles.backBtn} />
      </View>

      <ImportShelfPanel />
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
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.bg
  },
  backBtn: { width: 32, alignItems: "center" },
  backIcon: { fontSize: 26, color: colors.text, lineHeight: 30 },
  topTitle: { fontSize: 16, fontWeight: "700", color: colors.text }
});
