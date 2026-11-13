// Timestamp: 2026-11-13 17:42
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

const entries = [
  { title: "复习生词", hint: "到期待复习的词", href: "/review" as const },
  { title: "看视频", hint: "YouTube 双语字幕", href: "/watch" as const },
  { title: "读短文", hint: "分级读物", href: "/lectura" as const }
];

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>
          Esponal<Text style={styles.brandDot}>.</Text>
        </Text>

        <Text style={styles.eyebrow}>欢迎回来</Text>
        <Text style={styles.title}>
          西班牙语,{"\n"}从<Text style={styles.accent}>听懂</Text>开始
        </Text>
        <Text style={styles.subtitle}>
          {user?.email ? `已登录:${user.email}` : "继续你的西语之旅。"}
        </Text>

        <View style={styles.cards}>
          {entries.map((entry) => (
            <Link asChild href={entry.href} key={entry.title}>
              <View style={styles.card}>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{entry.title}</Text>
                  <Text style={styles.cardHint}>{entry.hint}</Text>
                </View>
                <Text style={styles.cardArrow}>→</Text>
              </View>
            </Link>
          ))}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>当前是骨架版</Text>
          <Text style={styles.noticeBody}>
            「复习」已经接了真实数据,其余两屏在 P2 补齐。
            视频播放会走 YouTube iframe(平台限制),但字幕、查词、控制条都是原生。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  brandDot: { color: colors.brand500 },
  eyebrow: {
    marginTop: 34,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.text
  },
  accent: { color: colors.brand600 },
  subtitle: {
    marginTop: spacing.md,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary
  },
  cards: { marginTop: spacing.xl, gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg
  },
  cardText: { gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardHint: { fontSize: 12.5, color: colors.textSecondary },
  cardArrow: { fontSize: 18, color: colors.brand500, fontWeight: "700" },
  notice: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    padding: spacing.lg
  },
  noticeTitle: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
  noticeBody: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.brand700
  }
});
