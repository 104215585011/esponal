// Timestamp: 2026-11-14 02:48
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { AppVersionInfo } from "@/api/appVersion";
import { colors, radius, spacing } from "@/theme";

type UpdateDialogProps = {
  visible: boolean;
  current: string;
  info: AppVersionInfo | null;
  onDismiss: () => void;
};

/**
 * 更新提示。
 *
 * 侧载 APK 不会自动更新,所以做成:发现新版 → 提示 → 一键打开下载页。
 * Android 不允许应用静默安装 APK,最后一步必须用户手动确认,这是系统限制。
 */
export function UpdateDialog({ visible, current, info, onDismiss }: UpdateDialogProps) {
  const openDownload = async () => {
    const url = info?.downloadUrl ?? info?.releaseUrl;
    if (url) {
      await Linking.openURL(url).catch(() => undefined);
    }
    onDismiss();
  };

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Update</Text>
          <Text style={styles.title}>
            发现新版本 {info?.latestVersion ?? ""}
          </Text>
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

          <Pressable onPress={openDownload} style={styles.primaryButton}>
            <Text style={styles.primaryText}>去下载</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>稍后</Text>
          </Pressable>

          <Text style={styles.hint}>
            下载完成后点安装包覆盖安装,数据不会丢。
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
    maxHeight: 160,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md
  },
  notesContent: { paddingBottom: 2 },
  notes: {
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textSecondary
  },
  primaryButton: {
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
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
