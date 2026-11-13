// Timestamp: 2026-11-13 17:46
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/theme";

/** 阅读 tab —— P2/P3 接 /api/lectura/stories + 阅读器。 */
export default function LecturaScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Lectura</Text>
        <Text style={styles.title}>阅读</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>P2 上线</Text>
          <Text style={styles.placeholderBody}>
            分级短文列表 + 原生阅读器。段落音频用服务端已生成的 mp3 直接播,
            点词、加生词本都是原生交互。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  placeholder: {
    marginTop: spacing.xl,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  placeholderTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  placeholderBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary
  }
});
