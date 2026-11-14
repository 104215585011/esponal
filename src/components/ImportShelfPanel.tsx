// Timestamp: 2026-11-15 07:55
import { useCallback, useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Alert,
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

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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

/** 导入书架列表（EPUB / PDF）：支持添加导入、删除与阅读 */
export function ImportShelfPanel() {
  const router = useRouter();
  const [docs, setDocs] = useState<ImportedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const handleImport = useCallback(async () => {
    if (uploading) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip", "application/octet-stream"],
        copyToCacheDirectory: true
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const lowerName = (asset.name || "").toLowerCase();
      if (!lowerName.endsWith(".epub") && !lowerName.endsWith(".pdf")) {
        Alert.alert("格式不支持", "目前仅支持导入 .epub 或 .pdf 格式的西语书籍。");
        return;
      }

      if (typeof asset.size === "number" && asset.size > MAX_UPLOAD_BYTES) {
        Alert.alert(
          "文件过大",
          "手机端直传目前支持 4MB 以内的 EPUB 或 PDF，较大的书籍可从电脑端网页导入。"
        );
        return;
      }

      setUploading(true);
      const mimeType =
        asset.mimeType ||
        (lowerName.endsWith(".epub") ? "application/epub+zip" : "application/pdf");

      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || (lowerName.endsWith(".epub") ? "book.epub" : "book.pdf"),
        type: mimeType
      } as unknown as Blob);

      const res = await apiFetch<{ document?: ImportedDoc }>("/api/import/upload", {
        method: "POST",
        body: form
      });

      if (res.document) {
        setDocs((prev) => [res.document!, ...prev]);
      } else {
        await load(true);
      }
    } catch (e) {
      Alert.alert("导入失败", e instanceof Error ? e.message : "请稍后再试");
    } finally {
      setUploading(false);
    }
  }, [uploading, load]);

  const confirmDelete = useCallback((doc: ImportedDoc) => {
    Alert.alert("删除书籍", `确定从书架移除《${doc.title}》吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeletingId(doc.id);
            try {
              await apiFetch<{ deleted: boolean }>(
                `/api/import/${encodeURIComponent(doc.id)}`,
                { method: "DELETE" }
              );
              setDocs((prev) => prev.filter((item) => item.id !== doc.id));
            } catch (e) {
              Alert.alert("删除失败", e instanceof Error ? e.message : "请稍后再试");
            } finally {
              setDeletingId(null);
            }
          })();
        }
      }
    ]);
  }, []);

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
      <View style={styles.actionHeader}>
        <Pressable
          disabled={uploading}
          onPress={() => void handleImport()}
          style={({ pressed }) => [
            styles.importBtn,
            uploading && styles.btnDisabled,
            pressed && styles.cardPressed
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <AppIcon color="#fff" name="shelf" size={16} />
          )}
          <Text style={styles.importBtnText}>
            {uploading ? "正在上传解析…" : "+ 导入 EPUB / PDF（4MB 内）"}
          </Text>
        </Pressable>
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
            点上方按钮可直接选取手机里的 EPUB / PDF；大文件也可以在网页端 www.pcmuz.cn/import 上传。
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {docs.map((doc) => {
            const isEpub = doc.kind === "epub";
            const isDeleting = deletingId === doc.id;
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

                  <View style={styles.headRight}>
                    <Text style={styles.statusText}>
                      {doc.status === "ready" ? "打开阅读" : doc.status}
                    </Text>
                    <Pressable
                      disabled={isDeleting}
                      hitSlop={10}
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDelete(doc);
                      }}
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteText}>{isDeleting ? "删除中…" : "删除"}</Text>
                    </Pressable>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.docTitle}>
                  {doc.title}
                </Text>

                <View style={styles.cardFoot}>
                  <Text style={styles.docMeta}>
                    {doc.unitCount > 0 ? `共 ${doc.unitCount} 单元 · ` : ""}
                    {formatPositionLabel(doc.kind, doc.lastPosition)}
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  actionHeader: { gap: spacing.xs },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand600
  },
  importBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
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
  headRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  kindBadge: {
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  kindBadgePdf: { backgroundColor: colors.amber50 },
  kindText: { fontSize: 10.5, fontWeight: "700", color: colors.brand700 },
  kindTextPdf: { color: colors.amber700 },
  statusText: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerBg
  },
  deleteText: { fontSize: 11, fontWeight: "600", color: colors.danger },
  docTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text, lineHeight: 22 },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  docMeta: { fontSize: 12, color: colors.textSecondary }
});
