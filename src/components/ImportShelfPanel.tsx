// Timestamp: 2026-11-15 06:58
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
import { useRouter } from "expo-router";

import { apiFetch } from "@/api/client";
import { AppIcon } from "@/components/AppIcon";
import { colors, radius, spacing } from "@/theme";

export type ImportedDoc = {
  id: string;
  title: string;
  kind: "pdf" | "epub";
  status: string;
  unitCount: number;
  lastPosition: string;
  updatedAt?: string;
};

function formatPositionLabel(kind: "pdf" | "epub", pos: string) {
  if (!pos) return "尚未开始";
  if (kind === "epub") {
    const match = pos.match(/^epub:(\d+)/);
    if (match) return `第 ${Number(match[1]) + 1} 章`;
  }
  return pos;
}

/** 导入书架列表（EPUB / PDF），可供「阅读」Tab 书架分段与独立 /imports 页面复用 */
export function ImportShelfPanel() {
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
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.tipBanner}>
        <AppIcon color={colors.brand700} name="shelf" size={16} />
        <Text style={styles.tipText}>
          同步网页端（www.pcmuz.cn/import）上传的 EPUB 与 PDF，EPUB 支持章节阅读与点词查变位。
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : docs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>书架还是空的</Text>
          <Text style={styles.emptyHint}>
            可以在电脑或手机浏览器打开 www.pcmuz.cn/import 上传西语 PDF 或 EPUB，这里会自动同步。
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {docs.map((doc) => {
            const isEpub = doc.kind === "epub";
            return (
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
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.kindBadge, !isEpub && styles.kindBadgePdf]}>
                    <Text style={[styles.kindText, !isEpub && styles.kindTextPdf]}>
                      {doc.kind.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.statusText}>
                    {doc.status === "ready" ? "打开阅读" : doc.status}
                  </Text>
                </View>

                <Text numberOfLines={2} style={styles.docTitle}>
                  {doc.title}
                </Text>

                <View style={styles.cardFoot}>
                  <Text style={styles.docMeta}>
                    共 {doc.unitCount} 单元 · {formatPositionLabel(doc.kind, doc.lastPosition)}
                  </Text>
                  <AppIcon color={colors.textTertiary} name="chevron" size={14} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  tipBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.brand700
  },
  center: { paddingVertical: 60, alignItems: "center", gap: spacing.md },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    gap: 6
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  emptyHint: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  list: { gap: spacing.md },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: 8
  },
  cardPressed: { opacity: 0.78 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kindBadge: {
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  kindBadgePdf: {
    backgroundColor: colors.amber50
  },
  kindText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700
  },
  kindTextPdf: {
    color: colors.amber700
  },
  statusText: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  docTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text, lineHeight: 22 },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  docMeta: { fontSize: 12, color: colors.textSecondary }
});
