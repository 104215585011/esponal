// Timestamp: 2026-11-13 17:45
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/theme";

/**
 * 视频 tab —— P2 会做成:YouTube iframe(唯一 WebView 区域)+ 原生字幕列表 + 点词查词。
 * 现在先占位,保证 5 tab 完整、导航不空。
 */
export default function WatchScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>Video</Text>
        <Text style={styles.title}>视频</Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>P2 上线</Text>
          <Text style={styles.placeholderBody}>
            这一屏会做成:上方 YouTube 画面(平台限制,只能用 iframe),
            下方原生字幕列表 —— 滚动、当前句高亮、点词查词全部原生控件。
          </Text>
        </View>

        <View style={styles.list}>
          {[
            "原生字幕列表(FlashList,长视频不卡)",
            "点词 → 原生查词面板(300ms 内出卡)",
            "播放控制条自己画(进度/倍速/上下句)",
            "字幕本地缓存,离线可看"
          ].map((item) => (
            <View key={item} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
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
  },
  list: { marginTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  dot: {
    marginTop: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brand500
  },
  rowText: { flex: 1, fontSize: 13, lineHeight: 21, color: colors.textSecondary }
});
