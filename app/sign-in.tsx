// Timestamp: 2026-11-13 17:32
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing } from "@/theme";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <Text style={styles.brand}>
              Esponal<Text style={styles.brandDot}>.</Text>
            </Text>
          </View>

          <View style={styles.headline}>
            <Text style={styles.eyebrow}>欢迎回来</Text>
            <Text style={styles.title}>
              西班牙语,{"\n"}从<Text style={styles.titleAccent}>听懂</Text>开始
            </Text>
            <Text style={styles.subtitle}>
              登录后继续你的进度:生词、字幕、阅读都在这儿。
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>邮箱</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>密码</Text>
              <TextInput
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={submit}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                busy && styles.buttonBusy
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>登录</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            同一个账号通用于网页版,进度自动同步。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl
  },
  brandRow: { paddingTop: spacing.lg },
  brand: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  brandDot: { color: colors.brand500 },
  headline: { marginTop: 40 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 32,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.text
  },
  titleAccent: { color: colors.brand600 },
  subtitle: {
    marginTop: spacing.md,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary
  },
  form: { marginTop: 36, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text
  },
  errorBox: {
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  errorText: { fontSize: 13, color: colors.danger },
  button: {
    marginTop: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonPressed: { backgroundColor: colors.brand600 },
  buttonBusy: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  footnote: {
    marginTop: spacing.xl,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center"
  }
});
