// Timestamp: 2026-11-15 15:25
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE, apiFetch, tokenStore } from "@/api/client";
import { translateParagraphs } from "@/api/lectura";
import { LookupSheet } from "@/components/LookupSheet";
import { ParagraphBlock } from "@/components/ParagraphBlock";
import { usePreferences } from "@/hooks/usePreferences";
import { type LearningLanguage } from "@/lib/preferences";
import { speakAuto, stopSpeaking } from "@/lib/speech";
import { colors, radius, spacing } from "@/theme";

type EpubChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
};

type PdfPage = {
  pageNumber: number;
  text: string;
};

type PaperTheme = "white" | "warm" | "night";

const PAPER_STYLES: Record<
  PaperTheme,
  { label: string; bg: string; card: string; text: string; sub: string; border: string }
> = {
  white: {
    label: "白",
    bg: "#FFFFFF",
    card: "#F8FAFC",
    text: "#0F172A",
    sub: "#475569",
    border: "#E2E8F0"
  },
  warm: {
    label: "暖",
    bg: "#FBF6EA",
    card: "#F5ECD7",
    text: "#3F3526",
    sub: "#6E5F47",
    border: "#E7DABF"
  },
  night: {
    label: "夜",
    bg: "#13161B",
    card: "#1D222A",
    text: "#E5E7EB",
    sub: "#9CA3AF",
    border: "#2D333D"
  }
};

const FONT_SIZES = [15, 17, 20] as const;

function parseUnitIndex(kind: "epub" | "pdf", lastPosition?: string) {
  if (!lastPosition) return 0;
  if (kind === "epub") {
    const match = lastPosition.match(/^epub:(\d+)/);
    const parsed = match ? Number(match[1]) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  const match = lastPosition.match(/^pdf:(\d+)/);
  const parsed = match ? Number(match[1]) : 1;
  return Number.isFinite(parsed) && parsed >= 1 ? parsed - 1 : 0;
}

function normalizeDocLang(raw?: string, fallback: LearningLanguage = "es"): LearningLanguage {
  if (raw === "es" || raw === "en" || raw === "fr" || raw === "ja") return raw;
  return fallback;
}

/**
 * 统一导入电子书/PDF 精读阅读器：
 * - 支持目录抽屉直接跳章 / 跳页
 * - 支持双语对照翻译开关（按当前章/页缓存翻译）
 * - 支持字号与护眼背景切换、整段朗读、点击任意单词查词加生词本
 * - 扫描版 PDF 保留系统 PDF 阅读器打开兜底
 */
export default function ImportReaderScreen() {
  const router = useRouter();
  const prefs = usePreferences();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    kind?: string;
    language?: string;
    lastPosition?: string;
  }>();

  const id = typeof params.id === "string" ? params.id : "";
  const title = typeof params.title === "string" && params.title ? params.title : "导入文档";
  const kind = params.kind === "pdf" ? "pdf" : "epub";
  const docLang = normalizeDocLang(
    typeof params.language === "string" ? params.language : undefined,
    prefs.learningLang
  );
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

  const [tocVisible, setTocVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [paper, setPaper] = useState<PaperTheme>("warm");
  const [fontSizeIdx, setFontSizeIdx] = useState<number>(1);
  const [bilingual, setBilingual] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translationsByUnit, setTranslationsByUnit] = useState<Record<number, string[]>>({});
  const [speakingParaIdx, setSpeakingParaIdx] = useState<number | null>(null);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | undefined>(undefined);

  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const theme = PAPER_STYLES[paper];
  const fontSize = FONT_SIZES[fontSizeIdx] ?? 17;

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (kind === "epub") {
      apiFetch<{ chapters: EpubChapter[]; unitCount: number }>(
        `/api/import/${encodeURIComponent(id)}/epub`
      )
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
      apiFetch<{ pages: PdfPage[]; unitCount: number }>(
        `/api/import/${encodeURIComponent(id)}/pdf`
      )
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

  const activeText =
    kind === "epub" ? (chapters[unitIndex]?.text ?? "") : (pdfPages[unitIndex]?.text ?? "");

  const paragraphs = useMemo(() => {
    if (!activeText) return [];
    return activeText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [activeText]);

  // 开启「双语对照」且当前页尚未缓存译文时，按批自动翻译
  useEffect(() => {
    if (!bilingual || paragraphs.length === 0) return;
    if (translationsByUnit[unitIndex]) return;

    let cancelled = false;
    setTranslating(true);
    translateParagraphs(paragraphs.slice(0, 35), docLang)
      .then((list) => {
        if (cancelled) return;
        setTranslationsByUnit((prev) => ({ ...prev, [unitIndex]: list }));
      })
      .catch(() => {
        // 翻译失败时不阻断原文阅读
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bilingual, paragraphs, unitIndex, docLang, translationsByUnit]);

  const syncProgress = useCallback(
    async (nextIndex: number) => {
      if (!id) return;
      const lastPosition = kind === "epub" ? `epub:${nextIndex}:0` : `pdf:${nextIndex + 1}`;
      try {
        await apiFetch(`/api/import/${encodeURIComponent(id)}/progress`, {
          method: "POST",
          body: JSON.stringify({
            lastPosition,
            unitCount: unitCount || totalUnits
          })
        });
      } catch {
        // ignore progress sync error
      }
    },
    [id, kind, unitCount, totalUnits]
  );

  const goToUnit = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= totalUnits) return;
      stopSpeaking();
      setSpeakingParaIdx(null);
      setUnitIndex(nextIndex);
      setTocVisible(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
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
        Alert.alert("提示", "请先登录后再打开原版 PDF");
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
        { headers: { Authorization: `Bearer ${token}` } }
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
      Alert.alert("打开失败", e instanceof Error ? e.message : "下载 PDF 失败");
    } finally {
      setOpeningPdf(false);
    }
  }, [id, openingPdf, title]);

  const activeTitle =
    kind === "epub"
      ? chapters[unitIndex]?.title || `第 ${unitIndex + 1} 章`
      : `第 ${pdfPages[unitIndex]?.pageNumber ?? unitIndex + 1} 页`;

  const currentTranslations = translationsByUnit[unitIndex] ?? [];

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.bg }]}>
      {/* 顶部栏：返回 · 标题 · 目录 · Aa显示 */}
      <View style={[styles.topBar, { borderBottomColor: theme.border, backgroundColor: theme.bg }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.topAction}>
          <Text style={[styles.topActionText, { color: colors.brand600 }]}>‹ 返回</Text>
        </Pressable>

        <Text numberOfLines={1} style={[styles.topTitle, { color: theme.text }]}>
          {title}
        </Text>

        <View style={styles.topRightGroup}>
          {totalUnits > 0 ? (
            <Pressable onPress={() => setTocVisible(true)} style={styles.toolBtn}>
              <Text style={[styles.toolBtnText, { color: theme.text }]}>目录</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSettingsVisible((prev) => !prev)}
            style={[styles.toolBtn, settingsVisible && styles.toolBtnOn]}
          >
            <Text style={[styles.toolBtnText, { color: settingsVisible ? "#fff" : theme.text }]}>
              Aa
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 快捷双语对照栏 + 进度 */}
      {totalUnits > 0 ? (
        <View
          style={[
            styles.subBar,
            { backgroundColor: theme.card, borderBottomColor: theme.border }
          ]}
        >
          <Pressable
            onPress={() => setBilingual((prev) => !prev)}
            style={[styles.bilingualChip, bilingual && styles.bilingualChipOn]}
          >
            <Text style={[styles.bilingualText, bilingual && styles.bilingualTextOn]}>
              {bilingual ? "双语对照：开" : "双语对照：关"}
            </Text>
          </Pressable>

          <Text style={[styles.subBarUnit, { color: theme.sub }]}>
            {unitIndex + 1} / {totalUnits}
          </Text>

          {kind === "pdf" ? (
            <Pressable disabled={openingPdf} onPress={handleOpenPdf} style={styles.externalPill}>
              <Text style={styles.externalPillText}>{openingPdf ? "下载中" : "原版 PDF"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 字号与纸张设置面板 */}
      {settingsVisible ? (
        <View
          style={[
            styles.settingsPanel,
            { backgroundColor: theme.card, borderBottomColor: theme.border }
          ]}
        >
          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: theme.sub }]}>字号</Text>
            {(["小", "中", "大"] as const).map((label, idx) => (
              <Pressable
                key={label}
                onPress={() => setFontSizeIdx(idx)}
                style={[styles.settingChip, fontSizeIdx === idx && styles.settingChipOn]}
              >
                <Text
                  style={[styles.settingChipText, fontSizeIdx === idx && styles.settingChipTextOn]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: theme.sub }]}>底色</Text>
            {(Object.keys(PAPER_STYLES) as PaperTheme[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setPaper(key)}
                style={[styles.settingChip, paper === key && styles.settingChipOn]}
              >
                <Text
                  style={[styles.settingChipText, paper === key && styles.settingChipTextOn]}
                >
                  {PAPER_STYLES[key].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand500} />
          <Text style={[styles.loadingText, { color: theme.sub }]}>
            {kind === "pdf" ? "正在智能合并 PDF 自然段落…" : "正在解析电子书章节…"}
          </Text>
        </View>
      ) : kind === "pdf" && (error || pdfPages.length === 0) ? (
        <View style={styles.pdfContainer}>
          <View style={[styles.pdfCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.kindBadge}>PDF</Text>
            <Text style={[styles.pdfTitle, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.pdfHint, { color: theme.sub }]}>
              {error
                ? `应用内提取文字失败（${error}），可以直接用手机系统 PDF 阅读器浏览原版排版。`
                : "该 PDF 可能是纯图片扫描版，未能提取出可选文字。请点击下方按钮用系统 PDF 阅读器打开。"}
            </Text>
            <Pressable
              disabled={openingPdf}
              onPress={handleOpenPdf}
              style={[styles.primaryBtn, openingPdf && styles.btnDisabled]}
            >
              <Text style={styles.primaryBtnText}>
                {openingPdf ? "正在下载…" : "下载并用系统阅读器打开"}
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
          <Text style={[styles.loadingText, { color: theme.sub }]}>该文档暂无可显示的文本内容。</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.readerBody}>
          <Text style={[styles.chapterTitle, { color: theme.text }]}>{activeTitle}</Text>
          <Text style={[styles.readerTip, { color: theme.sub }]}>
            点任意单词查词与动词变位 · {translating && bilingual ? "正在翻译本页中文对照…" : "已适配自然段落"}
          </Text>

          {paragraphs.length === 0 ? (
            <Text style={[styles.loadingText, { color: theme.sub }]}>
              这一页没有提取到文本，请点「目录」跳转其他页，或点右上角「原版 PDF」查看。
            </Text>
          ) : (
            paragraphs.map((para, pIdx) => {
              const zh = currentTranslations[pIdx];
              const isSpeaking = speakingParaIdx === pIdx;
              return (
                <View
                  key={`${unitIndex}-${pIdx}`}
                  style={[
                    styles.paraCard,
                    {
                      borderBottomColor: theme.border
                    }
                  ]}
                >
                  <ParagraphBlock
                    first={pIdx === 0}
                    fontSize={fontSize}
                    onWordPress={(word) => {
                      setSelectedWord(word);
                      setSelectedContext(para.slice(0, 180));
                    }}
                    text={para}
                    textColor={theme.text}
                  />

                  {bilingual && zh ? (
                    <Text style={[styles.zhText, { color: theme.sub, fontSize: Math.max(13, fontSize - 3) }]}>
                      {zh}
                    </Text>
                  ) : null}

                  <View style={styles.paraActions}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        if (isSpeaking) {
                          stopSpeaking();
                          setSpeakingParaIdx(null);
                        } else {
                          setSpeakingParaIdx(pIdx);
                          speakAuto(para.slice(0, 180), { lang: docLang });
                        }
                      }}
                      style={[styles.speakChip, isSpeaking && styles.speakChipOn]}
                    >
                      <Text style={[styles.speakChipText, isSpeaking && styles.speakChipTextOn]}>
                        {isSpeaking ? "■ 停止" : "🔊 朗读本段"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <View style={styles.navRow}>
            <Pressable
              disabled={unitIndex <= 0}
              onPress={() => goToUnit(unitIndex - 1)}
              style={[
                styles.navBtn,
                { borderColor: theme.border, backgroundColor: theme.card },
                unitIndex <= 0 && styles.btnDisabled
              ]}
            >
              <Text style={[styles.navBtnText, { color: theme.text }]}>
                {kind === "pdf" ? "上一页" : "上一章"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setTocVisible(true)}>
              <Text style={[styles.pageIndicator, { color: theme.sub }]}>
                目录 ({unitIndex + 1} / {totalUnits})
              </Text>
            </Pressable>
            <Pressable
              disabled={unitIndex >= totalUnits - 1}
              onPress={() => goToUnit(unitIndex + 1)}
              style={[
                styles.navBtn,
                { borderColor: theme.border, backgroundColor: theme.card },
                unitIndex >= totalUnits - 1 && styles.btnDisabled
              ]}
            >
              <Text style={[styles.navBtnText, { color: theme.text }]}>
                {kind === "pdf" ? "下一页" : "下一章"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* 目录跳转弹窗 */}
      <Modal
        animationType="slide"
        onRequestClose={() => setTocVisible(false)}
        transparent
        visible={tocVisible}
      >
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setTocVisible(false)} style={styles.modalCloseArea} />
          <View style={[styles.modalSheet, { backgroundColor: theme.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                目录（共 {totalUnits} {kind === "pdf" ? "页" : "章"}）
              </Text>
              <Pressable onPress={() => setTocVisible(false)}>
                <Text style={styles.modalDone}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.tocList}>
              {kind === "epub"
                ? chapters.map((ch, idx) => {
                    const active = idx === unitIndex;
                    return (
                      <Pressable
                        key={`${ch.href}-${idx}`}
                        onPress={() => goToUnit(idx)}
                        style={[
                          styles.tocRow,
                          { borderBottomColor: theme.border },
                          active && styles.tocRowActive
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tocText,
                            { color: active ? colors.brand700 : theme.text },
                            active && styles.tocTextActive
                          ]}
                        >
                          {idx + 1}. {ch.title || `第 ${idx + 1} 章`}
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
                        style={[
                          styles.tocRow,
                          { borderBottomColor: theme.border },
                          active && styles.tocRowActive
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tocText,
                            { color: active ? colors.brand700 : theme.text },
                            active && styles.tocTextActive
                          ]}
                        >
                          第 {pg.pageNumber} 页 · {pg.text.slice(0, 32)}…
                        </Text>
                      </Pressable>
                    );
                  })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LookupSheet
        context={selectedContext}
        language={docLang}
        onClose={() => setSelectedWord(null)}
        word={selectedWord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    height: 48,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  topAction: { minWidth: 56 },
  topActionText: { fontSize: 14, fontWeight: "700" },
  topTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700", marginHorizontal: 8 },
  topRightGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  toolBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.16)"
  },
  toolBtnOn: { backgroundColor: colors.brand600 },
  toolBtnText: { fontSize: 12, fontWeight: "700" },
  subBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  bilingualChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  bilingualChipOn: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600
  },
  bilingualText: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
  bilingualTextOn: { color: "#fff" },
  subBarUnit: { fontSize: 12, fontWeight: "600" },
  externalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50
  },
  externalPillText: { fontSize: 11.5, fontWeight: "700", color: colors.brand700 },
  settingsPanel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm
  },
  settingGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingLabel: { fontSize: 12, fontWeight: "600", width: 34 },
  settingChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.15)"
  },
  settingChipOn: { backgroundColor: colors.brand600 },
  settingChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  settingChipTextOn: { color: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm
  },
  loadingText: { fontSize: 13.5, textAlign: "center" },
  errorText: { fontSize: 13.5, color: colors.danger, textAlign: "center" },
  pdfContainer: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  pdfCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
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
  pdfTitle: { fontSize: 18, fontWeight: "700" },
  pdfHint: { fontSize: 13.5, lineHeight: 20 },
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
  readerBody: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 70
  },
  chapterTitle: { fontSize: 21, fontWeight: "800", lineHeight: 29 },
  readerTip: { marginTop: 6, marginBottom: spacing.lg, fontSize: 12 },
  paraCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  zhText: {
    lineHeight: 22,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand500,
    paddingLeft: 10
  },
  paraActions: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  speakChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(148,163,184,0.14)"
  },
  speakChipOn: { backgroundColor: colors.brand600 },
  speakChipText: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  speakChipTextOn: { color: "#fff" },
  navRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1
  },
  navBtnText: { fontSize: 13.5, fontWeight: "600" },
  pageIndicator: { fontSize: 13, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  modalCloseArea: { flex: 1 },
  modalSheet: {
    maxHeight: "72%",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: 24
  },
  modalHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  modalTitle: { fontSize: 15.5, fontWeight: "700" },
  modalDone: { fontSize: 14, fontWeight: "700", color: colors.brand600 },
  tocList: { paddingHorizontal: spacing.xl },
  tocRow: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  tocRowActive: {
    backgroundColor: "rgba(16,185,129,0.08)"
  },
  tocText: { fontSize: 14 },
  tocTextActive: { fontWeight: "700" }
});
