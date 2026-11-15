// Timestamp: 2026-11-15 15:22
import { useCallback, useEffect, useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
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
import { usePreferences } from "@/hooks/usePreferences";
import { getPreferences, LEARNING_LANGUAGE_OPTIONS } from "@/lib/preferences";
import { colors, radius, spacing } from "@/theme";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_JSON_FALLBACK_BYTES = Math.floor(2.8 * 1024 * 1024);

export type ImportedDoc = {
  id: string;
  language?: string;
  title: string;
  kind: "pdf" | "epub";
  status: string;
  failReason?: string | null;
  sizeBytes?: number;
  unitCount: number;
  lastPosition: string;
  updatedAt?: string;
};

type ShelfScope = "all" | "current";

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getLangLabel(code?: string) {
  const found = LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === code);
  return found?.shortLabel ?? "西语";
}

function formatProgressLabel(doc: ImportedDoc) {
  const pos = doc.lastPosition || "";
  if (!pos) return doc.unitCount > 0 ? "尚未开始" : "点开阅读";
  if (doc.kind === "epub") {
    const match = pos.match(/^epub:(\d+)/);
    if (match) {
      const chap = Number(match[1]) + 1;
      const pct = doc.unitCount > 0 ? Math.min(100, Math.round((chap / doc.unitCount) * 100)) : 0;
      return doc.unitCount > 0 ? `第 ${chap}/${doc.unitCount} 章 · ${pct}%` : `第 ${chap} 章`;
    }
  }
  if (doc.kind === "pdf") {
    const match = pos.match(/^pdf:(\d+)/);
    if (match) {
      const pg = Number(match[1]);
      const pct = doc.unitCount > 0 ? Math.min(100, Math.round((pg / doc.unitCount) * 100)) : 0;
      return doc.unitCount > 0 ? `第 ${pg}/${doc.unitCount} 页 · ${pct}%` : `第 ${pg} 页`;
    }
  }
  return pos;
}

/**
 * 导入书架列表（EPUB / PDF）：
 * 默认展示用户全部已导入书籍并标明语种标签，支持切换「全部语种 / 当前语种」，
 * 并展示上传解析状态、大小、进度与阅读入口。
 */
export function ImportShelfPanel() {
  const router = useRouter();
  const prefs = usePreferences();
  const [scope, setScope] = useState<ShelfScope>("all");
  const [docs, setDocs] = useState<ImportedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeLangLabel = useMemo(
    () => getLangLabel(prefs.learningLang),
    [prefs.learningLang]
  );

  const load = useCallback(async (isRefresh = false, targetScope: ShelfScope = scope) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const qs = targetScope === "all" ? "?all=1" : "";
      const res = await apiFetch<{ documents: ImportedDoc[] }>(`/api/import/documents${qs}`);
      setDocs(res.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载书架失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    void load(false, scope);
  }, [load, scope, prefs.learningLang]);

  const handleImport = useCallback(async () => {
    if (uploading) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/epub+zip", "*/*"],
        copyToCacheDirectory: true
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const rawName = (asset.name || "").trim();
      const lowerName = rawName.toLowerCase();
      const rawMime = (asset.mimeType || "").toLowerCase();
      const isEpub = lowerName.endsWith(".epub") || rawMime.includes("epub");
      const isPdf = lowerName.endsWith(".pdf") || rawMime.includes("pdf");

      if (!isEpub && !isPdf) {
        Alert.alert("格式不支持", "目前支持导入 .epub 或 .pdf 格式的学习书籍。");
        return;
      }

      if (typeof asset.size === "number" && asset.size > MAX_UPLOAD_BYTES) {
        Alert.alert(
          "文件过大",
          "手机端直传支持 4MB 以内的 EPUB 或 PDF，更大的书籍可在网页端 www.pcmuz.cn/import 导入。"
        );
        return;
      }

      setUploading(true);
      const mimeType = isEpub ? "application/epub+zip" : "application/pdf";
      const safeAsciiName = isEpub ? "upload.epub" : "upload.pdf";
      const docTitle = rawName.replace(/\.[^.]+$/, "").trim() || "Imported document";
      const language = getPreferences().learningLang;

      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: safeAsciiName,
        type: mimeType
      } as unknown as Blob);
      form.append("title", docTitle);
      form.append("language", language);

      let res: { document?: ImportedDoc };
      try {
        res = await apiFetch<{ document?: ImportedDoc }>("/api/import/upload", {
          method: "POST",
          body: form
        });
      } catch (multipartError) {
        const tooBigForJson =
          typeof asset.size === "number" && asset.size > MAX_JSON_FALLBACK_BYTES;
        if (tooBigForJson) {
          throw multipartError;
        }
        const fileBase64 = await new File(asset.uri).base64();
        res = await apiFetch<{ document?: ImportedDoc }>("/api/import/upload", {
          method: "POST",
          body: JSON.stringify({
            fileBase64,
            filename: safeAsciiName,
            mimeType,
            title: docTitle,
            language
          })
        });
      }

      if (res.document) {
        setDocs((prev) => [res.document!, ...prev]);
      } else {
        await load(true, scope);
      }
    } catch (e) {
      Alert.alert("导入失败", e instanceof Error ? e.message : "请稍后再试");
    } finally {
      setUploading(false);
    }
  }, [uploading, load, scope]);

  const confirmDelete = useCallback((doc: ImportedDoc) => {
    Alert.alert("移除书籍", `确定从书架移除《${doc.title}》吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
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

  const handleOpenDoc = useCallback(
    (doc: ImportedDoc) => {
      if (doc.status !== "ready") {
        Alert.alert(
          "文档未就绪",
          doc.failReason ||
            (doc.status === "uploading"
              ? "该文件之前未上传完成，请删除后重新导入。"
              : "文档解析失败，请删除后重新上传。")
        );
        return;
      }
      router.push({
        pathname: "/import/[id]",
        params: {
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          language: doc.language ?? prefs.learningLang,
          lastPosition: doc.lastPosition ?? ""
        }
      } as never);
    },
    [router, prefs.learningLang]
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          colors={[colors.brand500]}
          onRefresh={() => void load(true, scope)}
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
            {uploading
              ? "正在上传并解析目录…"
              : `+ 导入书籍到「${activeLangLabel}」书架（EPUB / PDF）`}
          </Text>
        </Pressable>

        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope("all")}
            style={[styles.scopeChip, scope === "all" && styles.scopeChipActive]}
          >
            <Text style={[styles.scopeText, scope === "all" && styles.scopeTextActive]}>
              全部语种书籍
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope("current")}
            style={[styles.scopeChip, scope === "current" && styles.scopeChipActive]}
          >
            <Text style={[styles.scopeText, scope === "current" && styles.scopeTextActive]}>
              仅看{activeLangLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load(false, scope)} style={styles.retryBtn}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : docs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {scope === "current" ? `暂无${activeLangLabel}导入书籍` : "书架还是空的"}
          </Text>
          <Text style={styles.emptyHint}>
            {scope === "current"
              ? `可点击上方「全部语种书籍」查看其他语言导入，或直接导入一本新的 ${activeLangLabel} EPUB / PDF。`
              : "支持应用内分页精读、双语对照、整段朗读与点击单词查变位；大于 4MB 的电子书也可从网页端 www.pcmuz.cn/import 上传。"}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {docs.map((doc) => {
            const isEpub = doc.kind === "epub";
            const isDeleting = deletingId === doc.id;
            const sizeLabel = formatFileSize(doc.sizeBytes);
            const ready = doc.status === "ready";
            return (
              <Pressable
                key={doc.id}
                onPress={() => handleOpenDoc(doc)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardHead}>
                  <View style={styles.badgesRow}>
                    <View style={[styles.kindBadge, !isEpub && styles.kindBadgePdf]}>
                      <Text style={[styles.kindText, !isEpub && styles.kindTextPdf]}>
                        {doc.kind.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.langBadge}>
                      <Text style={styles.langBadgeText}>{getLangLabel(doc.language)}</Text>
                    </View>
                    {sizeLabel ? <Text style={styles.sizeText}>{sizeLabel}</Text> : null}
                  </View>

                  <View style={styles.headRight}>
                    <Text style={[styles.statusText, !ready && styles.statusFail]}>
                      {ready ? "精读" : doc.status === "uploading" ? "未传完" : "失败"}
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
                      <Text style={styles.deleteText}>{isDeleting ? "删除中…" : "移除"}</Text>
                    </Pressable>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.docTitle}>
                  {doc.title}
                </Text>

                <View style={styles.cardFoot}>
                  <Text style={styles.docMeta}>{formatProgressLabel(doc)}</Text>
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
  actionHeader: { gap: spacing.sm },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand600
  },
  importBtnText: { fontSize: 13.5, fontWeight: "700", color: "#fff" },
  scopeRow: {
    flexDirection: "row",
    gap: 8
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  scopeChipActive: {
    borderColor: colors.brand500,
    backgroundColor: colors.brand50
  },
  scopeText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  scopeTextActive: { color: colors.brand700 },
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
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  kindBadge: {
    backgroundColor: colors.brand50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  kindBadgePdf: { backgroundColor: colors.amber50 },
  kindText: { fontSize: 10.5, fontWeight: "700", color: colors.brand700 },
  kindTextPdf: { color: colors.amber700 },
  langBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  langBadgeText: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  sizeText: { fontSize: 11, color: colors.textTertiary },
  statusText: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  statusFail: { color: colors.danger },
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
