// Timestamp: 2026-11-14 13:00
import { useCallback, useEffect, useState } from "react";
import * as Sharing from "expo-sharing";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import {
  getDownloadJob,
  listDownloads,
  removeDownload,
  subscribeDownloadJob,
  type DownloadEntry,
  type DownloadJobState
} from "@/subtitles/subtitleDownload";
import { colors, radius, spacing } from "@/theme";

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/** 我的下载:本 App 下载到手机里的所有东西(字幕讲义 PDF 等),可分享/删除 */
export default function DownloadsScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DownloadEntry[]>([]);
  const [job, setJob] = useState<DownloadJobState>(getDownloadJob());

  const reload = useCallback(async () => {
    setEntries(await listDownloads());
    setJob(getDownloadJob());
  }, []);

  useEffect(() => {
    void reload();
    // 后台下载任务的状态变化也要反映进来(下载完成后列表自动出现新条目)
    return subscribeDownloadJob((state) => {
      setJob(state);
      if (!state.running) void reload();
    });
  }, [reload]);

  const handleShare = useCallback(async (entry: DownloadEntry) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("提示", "当前设备不支持分享");
        return;
      }
      await Sharing.shareAsync(entry.uri, {
        mimeType: "application/pdf",
        dialogTitle: entry.title
      });
    } catch {
      // 用户取消分享不算错误
    }
  }, []);

  const handleDelete = useCallback((entry: DownloadEntry) => {
    Alert.alert("删除文件", `确定删除「${entry.fileName}」?`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void removeDownload(entry).then(reload);
        }
      }
    ]);
  }, [reload]);

  const pct = job.total > 0 ? Math.round((job.translated / job.total) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>我的下载</Text>
      </View>

      {/* 正在进行的下载任务:实时进度 */}
      {job.running ? (
        <View style={styles.jobCard}>
          <Text style={styles.jobTitle}>正在翻译字幕:{job.title}</Text>
          <Text style={styles.jobMeta}>
            {job.translated} / {job.total} 句({pct}%)
          </Text>
          <View style={styles.jobTrack}>
            <View style={[styles.jobFill, { width: `${Math.max(3, pct)}%` }]} />
          </View>
        </View>
      ) : null}

      {job.done && job.entry ? (
        <Text style={styles.doneHint}>
          ✓ 「{job.entry.title}」已保存,可在下方列表打开
        </Text>
      ) : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={entries}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有下载内容</Text>
            <Text style={styles.emptyHint}>
              在播放页点 ⬇ 图标,可以把当前视频的双语字幕讲义(PDF)下载到这里。
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>PDF</Text>
            </View>
            <View style={styles.cardBody}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.cardMeta}>
                双语字幕讲义 · {formatDate(item.createdAt)} · {formatSize(item.size)}
              </Text>
            </View>
            <Pressable onPress={() => void handleShare(item)} style={styles.actionButton}>
              <Text style={styles.actionText}>分享</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(item)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>删除</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center"
  },
  backIcon: { marginTop: -3, fontSize: 24, color: colors.text, fontWeight: "300" },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  jobCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  jobTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  jobMeta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  jobTrack: {
    marginTop: spacing.md,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  jobFill: { height: 6, backgroundColor: colors.brand500, borderRadius: 3 },
  doneHint: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    fontSize: 12,
    color: colors.brand700
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: spacing.sm
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  emptyHint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textTertiary,
    textAlign: "center",
    paddingHorizontal: spacing.xl
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand50,
    alignItems: "center",
    justifyContent: "center"
  },
  cardIconText: { fontSize: 10, fontWeight: "800", color: colors.brand700 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  cardMeta: { fontSize: 11.5, color: colors.textTertiary },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  actionText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  deleteText: { fontSize: 12, fontWeight: "600", color: colors.danger }
});
