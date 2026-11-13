// Timestamp: 2026-11-14 03:28
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import type { AppVersionInfo } from "@/api/appVersion";
import { downloadAndInstall } from "@/update/installUpdate";
import { colors, radius, spacing } from "@/theme";

type UpdateDialogProps = {
  visible: boolean;
  current: string;
  info: AppVersionInfo | null;
  onDismiss: () => void;
};

type Phase = "idle" | "downloading" | "installing" | "error";

/**
 * 更新提示。
 *
 * 「立即更新」在 App 内完成:下载 APK → 唤起系统安装器。
 * 用户不用离开 App 去浏览器;最后一步点「安装」是 Android 系统强制要求,
 * 无法用代码绕过(不是实现缺陷)。
 */
export function UpdateDialog({ visible, current, info, onDismiss }: UpdateDialogProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ratio, setRatio] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 每次重新打开时重置状态
  useEffect(() => {
    if (visible) {
      setPhase("idle");
      setRatio(null);
      setErrorText(null);
    }
  }, [visible]);

  const downloadUrl = info?.downloadUrl ?? null;
  const releaseUrl = info?.releaseUrl ?? null;

  const startUpdate = async () => {
    if (!downloadUrl) {
      // 没有直链就退回浏览器
      if (releaseUrl) await Linking.openURL(releaseUrl).catch(() => undefined);
      return;
    }

    setPhase("downloading");
    setRatio(null);
    setErrorText(null);

    const result = await downloadAndInstall(downloadUrl, (progress) => {
      if (mountedRef.current) setRatio(progress.ratio);
    });

    if (!mountedRef.current) return;

    if (result.ok) {
      setPhase("installing");
      return;
    }

    setPhase("error");
    setErrorText(result.message ?? "更新失败");
  };

  const percent = ratio === null ? null : Math.round(ratio * 100);

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Update</Text>
          <Text style={styles.title}>发现新版本 {info?.latestVersion ?? ""}</Text>
          <Text style={styles.versionRow}>
            当前 {current}
            {info?.latestVersion ? `  →  最新 ${info.latestVersion}` : ""}
          </Text>

          {info?.notes ? (
            <ScrollView
              style={styles.notesBox}
              contentContainerStyle={styles.notesContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.notes}>{info.notes}</Text>
            </ScrollView>
          ) : null}

          {/* 下载进度 */}
          {phase === "downloading" ? (
            <View style={styles.progressBox}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: percent === null ? "35%" : `${Math.max(percent, 4)}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {percent === null ? "正在下载更新包…" : `正在下载 ${percent}%`}
              </Text>
            </View>
          ) : null}

          {phase === "installing" ? (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>安装器已打开</Text>
              <Text style={styles.tipBody}>
                在系统弹窗里点「安装」即可完成更新。登录状态和本地数据都会保留。
              </Text>
              <Text style={styles.tipBody}>
                如果没看到安装界面,可能需要在系统设置里允许「安装未知应用」。
              </Text>
            </View>
          ) : null}

          {phase === "error" ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorText}</Text>
              {releaseUrl ? (
                <Pressable
                  onPress={() => Linking.openURL(releaseUrl).catch(() => undefined)}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>改用浏览器下载</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {phase === "idle" || phase === "error" ? (
            <Pressable onPress={startUpdate} style={styles.primaryButton}>
              <Text style={styles.primaryText}>
                {phase === "error" ? "重试" : "立即更新"}
              </Text>
            </Pressable>
          ) : null}

          {phase === "downloading" ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.brand500} size="small" />
              <Text style={styles.busyText}>请保持网络连接</Text>
            </View>
          ) : null}

          {phase !== "downloading" ? (
            <Pressable onPress={onDismiss} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>
                {phase === "installing" ? "关闭" : "稍后"}
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.hint}>
            更新为覆盖安装,不需要卸载旧版,登录状态保留。
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: spacing.xl
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.text
  },
  versionRow: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    color: colors.textSecondary
  },
  notesBox: {
    marginTop: spacing.lg,
    maxHeight: 140,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md
  },
  notesContent: { paddingBottom: 2 },
  notes: { fontSize: 12.5, lineHeight: 20, color: colors.textSecondary },
  progressBox: { marginTop: spacing.lg, gap: spacing.sm },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.brand500
  },
  progressText: { fontSize: 12, color: colors.textSecondary },
  tipBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6
  },
  tipTitle: { fontSize: 13, fontWeight: "700", color: colors.brand700 },
  tipBody: { fontSize: 12, lineHeight: 19, color: colors.brand700 },
  errorBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm
  },
  errorText: { fontSize: 12.5, lineHeight: 19, color: colors.danger },
  linkButton: { alignSelf: "flex-start" },
  linkText: { fontSize: 12.5, fontWeight: "700", color: colors.danger },
  primaryButton: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  busyRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  busyText: { fontSize: 12, color: colors.textTertiary },
  secondaryButton: {
    marginTop: spacing.sm,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryText: { fontSize: 14, fontWeight: "600", color: colors.textTertiary },
  hint: {
    marginTop: spacing.sm,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.textTertiary,
    textAlign: "center"
  }
});
