// Timestamp: 2026-11-14 21:52
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { fetchStories, type LecturaListItem, type LecturaLevel } from "@/api/lectura";
import {
  getStorySummary,
  loadListeningLog,
  type StorySummary
} from "@/lib/listeningProgress";
import { colors, radius, spacing } from "@/theme";

const LEVELS: Array<LecturaLevel | "ALL"> = ["ALL", "A1", "A2", "B1"];

const LEVEL_LABEL: Record<LecturaLevel | "ALL", string> = {
  ALL: "全部",
  A1: "A1 入门",
  A2: "A2 基础",
  B1: "B1 进阶"
};

/**
 * 听力精听列表。
 *
 * 素材复用阅读短文的分段静态音频（每段 30 秒左右），因为精听的正确单位就是
 * 30 秒——太长记不住，太短听不出连读。这里只负责挑材料 + 显示练到哪了。
 */
export default function ListeningListScreen() {
  const router = useRouter();

  const [items, setItems] = useState<LecturaListItem[]>([]);
  const [level, setLevel] = useState<LecturaLevel | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 本地进度快照：每次页面回到前台重新读一次，练完一段回来数字就变 */
  const [progress, setProgress] = useState<Record<string, StorySummary>>({});
  /** 素材列表只拉一次；回到前台时只重算进度，不重新请求（否则每次回来都白屏一下） */
  const itemsRef = useRef<LecturaListItem[]>([]);

  const refreshProgress = useCallback(async (list: LecturaListItem[]) => {
    await loadListeningLog();
    const next: Record<string, StorySummary> = {};
    list.forEach((item) => {
      next[item.slug] = getStorySummary(item.slug, item.paragraphCount);
    });
    setProgress(next);
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetchStories();
        itemsRef.current = data;
        setItems(data);
        await refreshProgress(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshProgress]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // 从精听页返回时只刷新进度数字，不重拉列表
  useFocusEffect(
    useCallback(() => {
      void refreshProgress(itemsRef.current);
    }, [refreshProgress])
  );

  const filtered = useMemo(
    () => (level === "ALL" ? items : items.filter((item) => item.level === level)),
    [items, level]
  );

  const totalTrained = useMemo(
    () => Object.values(progress).reduce((sum, item) => sum + item.trained, 0),
    [progress]
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>听力精听</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.body}
        data={filtered}
        keyExtractor={(item) => item.slug}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.intro}>
              <Text style={styles.introTitle}>怎么练</Text>
              <Text style={styles.introLine}>1. 先别看文本,盲听两遍(听不懂也别急)</Text>
              <Text style={styles.introLine}>2. 揭晓原文,核对是哪几个音没抓住</Text>
              <Text style={styles.introLine}>3. 自评听懂率 + 勾错因:没听出音 / 词不认识 / 认识没反应</Text>
              <Text style={styles.introFoot}>
                听懂率 70–90% 是最佳训练区。全懂说明材料太简单,基本没听出说明该换更简单的。
              </Text>
            </View>

            <View style={styles.levelRow}>
              {LEVELS.map((item) => {
                const active = level === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setLevel(item)}
                    style={[styles.levelChip, active && styles.levelChipActive]}
                  >
                    <Text style={[styles.levelText, active && styles.levelTextActive]}>
                      {LEVEL_LABEL[item]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {totalTrained > 0 ? (
              <Text style={styles.trainedNote}>你在这些材料里已经精听过 {totalTrained} 段</Text>
            ) : null}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand500} />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void load()} style={styles.retry}>
                  <Text style={styles.retryText}>重试</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const summary = progress[item.slug];
          const trained = summary?.trained ?? 0;
          const done = trained > 0 && trained >= item.paragraphCount;

          return (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/listening/[slug]", params: { slug: item.slug } } as never)
              }
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={styles.cardHead}>
                <Text style={styles.levelBadge}>{item.level}</Text>
                <Text style={styles.cardMeta}>
                  {item.paragraphCount} 段 · {item.durationMin} 分钟
                </Text>
                {done ? <Text style={styles.doneBadge}>练完</Text> : null}
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardTitleZh}>{item.titleZh}</Text>

              <View style={styles.progressRow}>
                {trained === 0 ? (
                  <Text style={styles.progressIdle}>未开始</Text>
                ) : (
                  <>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(100, (trained / item.paragraphCount) * 100)}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      已练 {trained}/{item.paragraphCount} 段
                      {summary?.average !== null && summary?.average !== undefined
                        ? ` · 平均 ${summary.average}%`
                        : ""}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading || error ? undefined : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>这一档还没有材料</Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm
  },
  backButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 22, color: colors.text },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  intro: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6
  },
  introTitle: { fontSize: 13, fontWeight: "800", color: colors.brand700 },
  introLine: { fontSize: 12.5, lineHeight: 19, color: colors.brand700 },
  introFoot: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.brand600
  },
  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  levelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  levelChipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  levelText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  levelTextActive: { color: "#FFFFFF" },
  trainedNote: { marginTop: spacing.md, fontSize: 12, color: colors.textTertiary },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 3
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  levelBadge: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden"
  },
  cardMeta: { flex: 1, fontSize: 11.5, color: colors.textTertiary },
  doneBadge: { fontSize: 10.5, fontWeight: "700", color: colors.brand600 },
  cardTitle: { marginTop: 4, fontSize: 15.5, fontWeight: "700", color: colors.text },
  cardTitleZh: { fontSize: 12.5, color: colors.textSecondary },
  progressRow: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressIdle: { fontSize: 11.5, color: colors.textTertiary },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.brand500 },
  progressText: { fontSize: 11.5, color: colors.textSecondary },
  center: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg
  },
  retryText: { fontSize: 13, fontWeight: "600", color: colors.brand700 },
  emptyText: { fontSize: 13, color: colors.textTertiary }
});
