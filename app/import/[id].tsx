// Timestamp: 2026-11-15 14:35
import { useCallback, useEffect, useMemo, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE, apiFetch, tokenStore } from "@/api/client";
import { LookupSheet } from "@/components/LookupSheet";
import { usePreferences } from "@/hooks/usePreferences";
import { colors, radius, spacing } from "@/theme";

type EpubChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
};

type EpubResponse = {
  chapters: EpubChapter[];
  unitCount: number;
};

type PdfPage = {
  pageNumber: number;
  text: string;
};

type PdfResponse = {
  pages: PdfPage[];
  unitCount: number;
};

function parseUnitIndex(kind: "epub" | "pdf", lastPosition?: string) {
  if (!lastPosition) return 0;
  if (kind === "epub") {
    const match = lastPosition.match(/^epub:(\d+)/);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  const match = lastPosition.match(/^pdf:(\d+)/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed - 1 : 0;
}

function splitTokens(line: string) {
  return line.split(/(\s+)/);
}

function cleanWordToken(token: string) {
  return token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

/** 导入文档阅读页：EPUB 与 PDF 均支持应用内分页阅读 + 点词查词；扫描版 PDF 保留外部阅读器兜底 */
export default function ImportReaderScreen() {
  const router = useRouter();
  const prefs = usePreferences();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    kind?: string;
    lastPosition?: string;
  }>();

  const id = typeof params.id === "string" ? params.id : "";
  const title = typeof params.title === "string" && params.title ? params.title : "导入文档";
  const kind = params.kind === "pdf" ? "pdf" : "epub";
  const initialIndex = parseUnitIndex(
    kind,
    typeof params.lastPosition === "string" ? params.lastPosition : undefined
  );

  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [unitCount, setUnitCount] = useState(0);
  const [unitIndex, setUnitIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPdf, setOpeningPdf] = useState(false);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (kind === "epub") {
      apiFetch<EpubResponse>(`/api/import/${encodeURIComponent(id)}/epub`)
        .then((res) => {
          if (cancelled) return;
          const list = res.chapters ?? [];
          setChapters(list);
          setUnitCount(res.unitCount ?? list.length);
          setUnitIndex((prev) =>
            list.length > 0 ? Math.min(Math.max(0, prev), list.length - 1) : 0
          );
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "加载电子书失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      apiFetch<PdfResponse>(`/api/import/${encodeURIComponent(id)}/pdf`)
        .then((res) => {
          if (cancelled) return;
          const list = res.pages ?? [];
          setPdfPages(list);
          setUnitCount(res.unitCount ?? list.length);
          setUnitIndex((prev) =>
            list.length > 0 ? Math.min(Math.max(0, prev), list.length - 1) : 0
          );
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "提取 PDF 文本失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const totalUnits = kind === "epub" ? chapters.length : pdfPages.length;

  const syncProgress = useCallback(
    async (nextIndex: number) => {
      if (!id) return;
      const lastPosition =
        kind === "epub" ? `epub:${nextIndex}:0` : `pdf:${nextIndex + 1}`;
      try {
        await apiFetch(`/api/import/${encodeURIComponent(id)}/progress`, {
          method: "POST",
          body: JSON.stringify({
            lastPosition,
            unitCount: unitCount || totalUnits
          })
        });
      } catch {
        // 进度同步失败不打断阅读
      }
    },
    [id, kind, unitCount, totalUnits]
  );

  const goToUnit = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalUnits) return;
      setUnitIndex(nextIndex);
      void syncProgress(nextIndex);
    },
    [totalUnits, syncProgress]
  );

  const handleOpenPdf = useCallback(async () => {
    if (!id || openingPdf) return;
    setOpeningPdf(true);
    setError(null);
    try {
      const token = await tokenStore.getAccess();
      if (!token) {
        Alert.alert("提示", "请先登录后再打开 PDF 文档");
        return;
      }

      const dir = new Directory(Paths.cache, "imports");
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
      const safeName = `${id.replace(/[^a-zA-Z0-9_-]/g, "") || "document"}.pdf`;
      const destFile = new File(dir, safeName);
      if (destFile.exists) {
        destFile.delete();
      }

      const downloaded = await File.downloadFileAsync(
        `${API_BASE}/api/import/${encodeURIComponent(id)}/file`,
        destFile,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("提示", "当前设备不支持调用外部阅读器");
        return;
      }
      await Sharing.shareAsync(downloaded.uri, {
        mimeType: "application/pdf",
        dialogTitle: title
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "打开 PDF 失败");
    } finally {
      setOpeningPdf(false);
    }
  }, [id, openingPdf, title]);

  const activeText =
    kind === "epub"
      ? (chapters[unitIndex]?.text ?? "")
      : (pdfPages[unitIndex]?.text ?? "");

  const paragraphs = useMemo(() => {
    if (!activeText) return [];
    return activeText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [activeText]);

  const activeTitle =
    kind === "epub"
      ? chapters[unitIndex]?.title || `第 ${unitIndex + 1} 章`
      : `第 ${pdfPages[unitIndex]?.pageNumber ?? unitIndex + 1} 页`;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>
          {title}
        </Text>
        {kind === "pdf" ? (
          <Pressable disabled={openingPdf} onPress={handleOpenPdf} style={styles.externalBtn}>
            <Text style={styles.externalBtnText}>{openingPdf ? "下载中" : "原版 PDF"}</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={styles.loadingText}>
            {kind === "pdf" ? "正在提取 PDF 文字页…" : "正在解析电子书章节…"}
          </Text>
        </View>
      ) : kind === "pdf" && (error || pdfPages.length === 0) ? (
        <View style={styles.pdfContainer}>
          <View style={styles.pdfCard}>
            <Text style={styles.kindBadge}>PDF</Text>
            <Text style={styles.pdfTitle}>{title}</Text>
            <Text style={styles.pdfHint}>
              {error
                ? `应用内提取文字失败（${error}），可以直接用手机系统 PDF 阅读器打开原文件。`
                : "该 PDF 可能是纯图片扫描版，未能提取出可选文字。请用手机上的 PDF 阅读器直接浏览。"}
            </Text>
            <Pressable
              disabled={openingPdf}
              onPress={handleOpenPdf}
              style={[styles.primaryBtn, openingPdf && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>
                {openingPdf ? "正在下载…" : "下载并用系统 PDF 阅读器打开"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : totalUnits === 0 ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>该文档暂无可显示的文本内容。</Text>
        </View>
      ) : (
        <>
          <View style={styles.chapterBar}>
            <ScrollView
              contentContainerStyle={styles.chapterTabs}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {kind === "epub"
                ? chapters.map((ch, idx) => {
                    const active = idx === unitIndex;
                    return (
                      <Pressable
                        key={`${ch.href}-${idx}`}
                        onPress={() => goToUnit(idx)}
                        style={[styles.chapterPill, active && styles.chapterPillActive]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.chapterPillText,
                            active && styles.chapterPillTextActive
                          ]}
                        >
                          {ch.title || `第 ${idx + 1} 章`}
                        </Text>
                      </Pressable>
                    );
                  })
                : pdfPages.map((pg, idx) => {
                    const active = idx === unitIndex;
                    return (
                      <Pressable
                        key={pg.pageNumber}
                        onPress={() => goToUnit(idx)}
                        style={[styles.chapterPill, active && styles.chapterPillActive]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.chapterPillText,
                            active && styles.chapterPillTextActive
                          ]}
                        >
                          第 {pg.pageNumber} 页
                        </Text>
                      </Pressable>
                    );
                  })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.readerBody}>
            <Text style={styles.chapterTitle}>{activeTitle}</Text>
            <Text style={styles.readerTip}>轻触任意外语单词即可查词与加入生词本</Text>

            {paragraphs.length === 0 ? (
              <Text style={styles.loadingText}>这一页没有提取到文本，请翻页或点右上角“原版 PDF”查看排版。</Text>
            ) : (
              paragraphs.map((para, pIdx) => (
                <Text key={pIdx} style={styles.paragraph}>
                  {splitTokens(para).map((token, tIdx) => {
                    const cleaned = cleanWordToken(token);
                    if (!cleaned) {
                      return <Text key={tIdx}>{token}</Text>;
                    }
                    return (
                      <Text
                        key={tIdx}
                        onPress={() => {
                          setSelectedWord(cleaned);
                          setSelectedContext(para.slice(0, 160));
                        }}
                        style={styles.wordToken}
                      >
                        {token}
                      </Text>
                    );
                  })}
                </Text>
              ))
            )}

            <View style={styles.navRow}>
              <Pressable
                disabled={unitIndex <= 0}
                onPress={() => goToUnit(unitIndex - 1)}
                style={[styles.navBtn, unitIndex <= 0 && styles.btnDisabled]}
              >
                <Text style={styles.navBtnText}>{kind === "pdf" ? "上一页" : "上一章"}</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>
                {unitIndex + 1} / {totalUnits}
              </Text>
              <Pressable
                disabled={unitIndex >= totalUnits - 1}
                onPress={() => goToUnit(unitIndex + 1)}
                style={[
                  styles.navBtn,
                  unitIndex >= totalUnits - 1 && styles.btnDisabled
                ]}
              >
                <Text style={styles.navBtnText}>{kind === "pdf" ? "下一页" : "下一章"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </>
      )}

      <LookupSheet
        context={selectedContext}
        language={prefs.learningLang}
        onClose={() => setSelectedWord(null)}
        word={selectedWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  externalBtn: { minWidth: 64, alignItems: "flex-end" },
  externalBtnText: { fontSize: 12.5, fontWeight: "600", color: colors.brand600 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15.5,
    fontWeight: "700",
    color: colors.text
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm
  },
  loadingText: { fontSize: 13.5, color: colors.textSecondary },
  errorText: { fontSize: 13.5, color: colors.danger, textAlign: "center" },
  pdfContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center"
  },
  pdfCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md
  },
  kindBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    color: colors.brand700,
    fontSize: 11,
    fontWeight: "700"
  },
  pdfTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  pdfHint: { fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  primaryBtn: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand500,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.45 },
  chapterBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSubtle
  },
  chapterTabs: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 8
  },
  chapterPill: {
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  chapterPillActive: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  chapterPillText: { fontSize: 12.5, fontWeight: "600", color: colors.textSecondary },
  chapterPillTextActive: { color: "#fff" },
  readerBody: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  chapterTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  readerTip: { fontSize: 12, color: colors.textTertiary },
  paragraph: {
    fontSize: 16.5,
    lineHeight: 28,
    color: colors.text
  },
  wordToken: {
    color: colors.text
  },
  navRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle
  },
  navBtnText: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  pageIndicator: { fontSize: 13, color: colors.textSecondary }
});
