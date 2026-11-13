// Timestamp: 2026-11-13 17:52
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "找不到页面" }} />
      <View style={styles.container}>
        <Text style={styles.title}>这个页面不存在</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>回到首页</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.bgSubtle
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  link: { marginTop: spacing.lg, paddingVertical: spacing.md },
  linkText: { fontSize: 14, fontWeight: "600", color: colors.brand600 }
});
