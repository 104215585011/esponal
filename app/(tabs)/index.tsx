// Timestamp: 2026-11-14 14:48
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { fetchReviewQueue } from "@/api/review";
import {
  fetchVocabStats,
  fetchWatchHistory,
  type VocabStats,
  type WatchHistoryItem
} from "@/api/stats";
import { colors, radius, spacing } from "@/theme";

/**
 * 首页 = 学习看板。
 *
 * 数据全部来自真实接口:
 * - /api/vocab/review  → 今日待复习张数(主 CTA)
 * - /api/vocab/stats   → 词库总量 / 本周新增 / 见过次数分布(掌握度)
 * - /api/watch/history → 最近观看(点一下接着看)
 *
 * 三个接口用 allSettled 并发,任一失败不拖垮整页 —— 没数据就先显示占位。
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [due, setDue] = useState<number | null>(null);
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const [queueRes, statsRes, historyRes] = await Promise.allSettled([
      fetchReviewQueue(),
      fetchVocabStats(),
      fetchWatchHistory(6)
    ]);

    if (queueRes.status === "fulfilled") setDue(queueRes.value.totalDue ?? 0);
    if (statsRes.status === "fulfilled") setStats(statsRes.value);
    if (historyRes.status === "fulfilled") setHistory(historyRes.value);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 从复习/播放页返回时自动刷新,避免数字过期
  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load])
  );

  const totalSaved = stats?.totalSaved ?? 0;
  const weeklyNew = stats?.weeklyNew ?? 0;
  const buckets = stats?.encounterBuckets ?? [];
  const mastered = buckets.find((b) => b.label.includes("6"))?.count ?? 0;
  const bucketTotal = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            Esponal<Text style={styles.brandDot}>.</Text>
          </Text>
          <Pressable
            onPress={() => router.push("/search" as never)}
            style={({ pressed }) => [styles.searchEntry, pressed && styles.pressed]}
          >
            <Text style={styles.searchEntryText}>🔍 搜视频</Text>
          </Pressable>
        </View>

        <Text style={styles.hello}>
          {user?.name ? `${user.name},` : "Hola,"}今天先从哪一步开始?
        </Text>

        {/* 主 CTA:今日待复习 */}
        <Pressable
          onPress={() => router.push("/review" as never)}
          style={({ pressed }) => [styles.dueCard, pressed && styles.pressed]}
        >
          <View style={styles.dueTextWrap}>
            <Text style={styles.dueLabel}>今日待复习</Text>
            {loading && due === null ? (
              <ActivityIndicator color="#fff" style={styles.dueSpin} />
            ) : (
              <Text style={styles.dueNumber}>
                {due ?? 0}
                <Text style={styles.dueUnit}> 张</Text>
              </Text>
            )}
            <Text style={styles.dueHint}>
              {due === 0 ? "清空了,可以找点新材料听听" : "按 FSRS 排的,先刷完再学新的"}
            </Text>
          </View>
          <View style={styles.dueAction}>
            <Text style={styles.dueActionText}>{due === 0 ? "去复习" : "开始"}</Text>
            <Text style={styles.dueArrow}>→</Text>
          </View>
        </Pressable>

        {/* 统计三宫格 */}
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{loading && !stats ? "—" : totalSaved}</Text>
            <Text style={styles.statLabel}>词库总数</Text>
          </View>
          <View style={[styles.statCell, styles.statCellMiddle]}>
            <Text style={styles.statValue}>{loading && !stats ? "—" : weeklyNew}</Text>
            <Text style={styles.statLabel}>本周新增</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{loading && !stats ? "—" : mastered}</Text>
            <Text style={styles.statLabel}>见过 6 次+</Text>
          </View>
        </View>

        {/* 掌握度分布:见过次数越多越牢 */}
        {bucketTotal > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>记忆深度</Text>
            <View style={styles.bucketBar}>
              {buckets.map((bucket, index) => {
                const pct = bucketTotal > 0 ? (bucket.count / bucketTotal) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <View
                    key={bucket.label}
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      backgroundColor: BUCKET_COLORS[index % BUCKET_COLORS.length]
                    }}
                  />
                );
              })}
            </View>
            <View style={styles.legendRow}>
              {buckets.map((bucket, index) => (
                <View key={bucket.label} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: BUCKET_COLORS[index % BUCKET_COLORS.length] }
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {bucket.label} {bucket.count}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.cardFoot}>
              同一词在不同材料里反复出现才会进右边几档 —— 这是最能说明"真的记住了"的指标。
            </Text>
          </View>
        ) : null}

        {/* 最近观看 */}
        {history.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>接着看</Text>
              <Pressable onPress={() => router.push("/watch" as never)}>
                <Text style={styles.sectionMore}>全部 ›</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.historyRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {history.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: "/watch/[videoId]",
                      params: {
                        videoId: item.videoId,
                        title: item.title,
                        channelTitle: item.channelTitle,
                        thumbnail: item.thumbnail ?? ""
                      }
                    } as never)
                  }
                  style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
                >
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.historyThumb} />
                  ) : (
                    <View style={[styles.historyThumb, styles.historyThumbEmpty]} />
                  )}
                  <Text numberOfLines={2} style={styles.historyTitle}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.historyChannel}>
                    {item.channelTitle}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* 功能入口 */}
        <View style={styles.entryList}>
          {ENTRIES.map((entry) => (
            <Pressable
              key={entry.title}
              onPress={() => router.push(entry.href as never)}
              style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}
            >
              <Text style={styles.entryIcon}>{entry.icon}</Text>
              <View style={styles.entryText}>
                <Text style={styles.entryTitle}>{entry.title}</Text>
                <Text style={styles.entryHint}>{entry.hint}</Text>
              </View>
              <Text style={styles.entryArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const BUCKET_COLORS = ["#D6EFE3", "#A7DFC6", "#5EC79B", colors.brand600];

const ENTRIES = [
  { icon: "🎬", title: "看视频", hint: "双语字幕 + 点词查词", href: "/watch" },
  { icon: "🔍", title: "搜视频", hint: "按关键词找任意西语内容", href: "/search" },
  { icon: "📖", title: "读短文", hint: "分级读物 + 逐句解析", href: "/lectura" },
  { icon: "⬇️", title: "我的下载", hint: "已保存的双语字幕讲义", href: "/downloads" }
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brand: { fontSize: 19, fontWeight: "800", letterSpacing: -0.6, color: colors.text },
  brandDot: { color: colors.brand500 },
  searchEntry: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted
  },
  searchEntryText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  pressed: { opacity: 0.75 },
  hello: {
    marginTop: spacing.lg,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text
  },
  dueCard: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.brand600,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md
  },
  dueTextWrap: { flex: 1 },
  dueLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)"
  },
  dueSpin: { alignSelf: "flex-start", marginTop: 6 },
  dueNumber: { marginTop: 2, fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  dueUnit: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  dueHint: { marginTop: 2, fontSize: 11.5, color: "rgba(255,255,255,0.82)" },
  dueAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  dueActionText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  dueArrow: { fontSize: 13, fontWeight: "700", color: "#fff" },
  statRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md
  },
  statCell: { flex: 1, alignItems: "center", gap: 3 },
  statCellMiddle: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  statValue: { fontSize: 19, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  statLabel: { fontSize: 11, color: colors.textTertiary },
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  bucketBar: {
    marginTop: spacing.md,
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  legendRow: { marginTop: spacing.md, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10.5, color: colors.textSecondary },
  cardFoot: {
    marginTop: spacing.sm,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textTertiary
  },
  section: { marginTop: spacing.lg },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  sectionMore: { fontSize: 11.5, color: colors.textTertiary },
  historyRow: { gap: spacing.md, paddingRight: spacing.md },
  historyCard: { width: 168 },
  historyThumb: { width: 168, height: 94, borderRadius: radius.sm, backgroundColor: "#000" },
  historyThumbEmpty: { backgroundColor: colors.surfaceMuted },
  historyTitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    color: colors.text
  },
  historyChannel: { marginTop: 2, fontSize: 10.5, color: colors.textTertiary },
  entryList: {
    marginTop: spacing.xl,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  entryRowPressed: { backgroundColor: colors.surfaceMuted },
  entryIcon: { fontSize: 16, width: 22, textAlign: "center" },
  entryText: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  entryHint: { fontSize: 11.5, color: colors.textTertiary },
  entryArrow: { fontSize: 18, color: colors.textTertiary }
});
