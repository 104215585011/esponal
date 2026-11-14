// Timestamp: 2026-11-13 17:32
import { useCallback, useEffect, useState } from "react";
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

import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "@/auth/AuthProvider";
import { registerAccount } from "@/api/account";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  isGoogleConfigured
} from "@/config/google";
import { colors, radius, spacing } from "@/theme";

export default function SignInScreen() {
  const { signIn, signInWithGoogleToken } = useAuth();

  // Google 原生登录:id_token 交给服务端验签,客户端不接触 client_secret
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined
  });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogleIdToken = useCallback(
    async (idToken: string) => {
      setBusy(true);
      setError(null);
      try {
        await signInWithGoogleToken(idToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Google 登录失败");
      } finally {
        setBusy(false);
      }
    },
    [signInWithGoogleToken]
  );

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === "success") {
      const idToken =
        googleResponse.params?.id_token ?? googleResponse.authentication?.idToken ?? null;
      if (idToken) void handleGoogleIdToken(idToken);
      else setError("Google 没有返回 id_token,请重试");
    } else if (googleResponse.type === "error") {
      setError("Google 登录被取消或失败");
    }
  }, [googleResponse, handleGoogleIdToken]);

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        await registerAccount({ email: email.trim(), password, name: name.trim() });
      }
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
            <Text style={styles.eyebrow}>{mode === "signin" ? "欢迎回来" : "新建账号"}</Text>
            <Text style={styles.title}>
              西班牙语,{"\n"}从<Text style={styles.titleAccent}>听懂</Text>开始
            </Text>
            <Text style={styles.subtitle}>
              {mode === "signin"
                ? "登录后继续你的进度:生词、字幕、阅读都在这儿。"
                : "注册一个账号,网页版与 App 的进度共用一份。"}
            </Text>
          </View>

          <View style={styles.form}>
            <Pressable
              disabled={busy || !isGoogleConfigured || !googleRequest}
              onPress={() => void promptGoogle()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googlePressed,
                (!isGoogleConfigured || busy) && styles.googleDisabled
              ]}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>
                {isGoogleConfigured ? "使用 Google 继续" : "Google 登录(待配置 client id)"}
              </Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>或</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === "signup" ? (
              <View style={styles.field}>
                <Text style={styles.label}>昵称(可留空)</Text>
                <TextInput
                  onChangeText={setName}
                  placeholder="怎么称呼你"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                  value={name}
                />
              </View>
            ) : null}

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
                <Text style={styles.buttonText}>
                  {mode === "signin" ? "登录" : "注册并登录"}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              setMode((prev) => (prev === "signin" ? "signup" : "signin"));
              setError(null);
            }}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {mode === "signin" ? "还没有账号?注册一个 →" : "已有账号?直接登录 →"}
            </Text>
          </Pressable>

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
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  googlePressed: { backgroundColor: colors.surfaceMuted },
  googleDisabled: { opacity: 0.5 },
  googleG: { fontSize: 17, fontWeight: "800", color: "#4285F4" },
  googleText: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 11.5, color: colors.textTertiary },
  switchRow: { marginTop: spacing.lg, alignItems: "center" },
  switchText: { fontSize: 13, fontWeight: "600", color: colors.brand600 },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center"
  }
});
