// Timestamp: 2026-11-15 03:28
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { apiFetch } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

type ImportedDoc = {
  id: string;
  title: string;
  kind: "pdf" | "epub";
  status: string;
  unitCount: number;
  lastPosition: string;
  updatedAt?: string;
};

export default function ImportsScreen() {
  const router = useRouter();
  const [docs, setDocs] = useState<ImportedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ documents: ImportedDoc[] }>("/api/import/documents");
      setDocs(res.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.topTitle}>我的导入库</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
      >
        <Text style={styles.subtitle}>
          同步你在 Web 端导入的 PDF / EPUB 电子书与学习进度。
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand500} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : docs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有导入文档</Text>
            <Text style={styles.emptyHint}>
              可以在电脑或手机浏览器打开 www.pcmuz.cn/import 上传西语 PDF 或 EPUB，这里会自动同步。
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {docs.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() =>
                  router.push({
                    pathname: "/import/[id]",
                    params: {
                      id: doc.id,
                      title: doc.title,
                      kind: doc.kind,
                      lastPosition: doc.lastPosition ?? ""
                    }
                  } as never)
                }
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.kindBadge}>{doc.kind.toUpperCase()}</Text>
                  <Text style={styles.statusText}>
                    {doc.status === "ready" ? "点击阅读 →" : doc.status}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.docTitle}>
                  {doc.title}
                </Text>
                <Text style={styles.docMeta}>
                  共 {doc.unitCount} 单元 · 上次位置 {doc.lastPosition || "起始位置"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    borderBottomColor: colors.border,
    backgroundColor: colors.bg
  },
  backBtn: { minWidth: 56 },
  backText: { fontSize: 13.5, fontWeight: "600", color: colors.brand600 },
  topTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  scroll: { padding: spacing.lg, gap: spacing.md },
  subtitle: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  center: { paddingVertical: 48, alignItems: "center" },
  errorText: { fontSize: 13, color: colors.danger },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: 6
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  emptyHint: { fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  list: { gap: spacing.sm },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.md,
    gap: 6
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kindBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  statusText: { fontSize: 11.5, color: colors.textTertiary },
  docTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  docMeta: { fontSize: 12, color: colors.textSecondary }
});
