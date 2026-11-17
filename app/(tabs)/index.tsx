// Timestamp: 2026-11-15 07:05
import { useCallback, useState } from "react";
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
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { colors, radius, spacing } from "@/theme";
import {
  adoptServerProgress,
  formatPosition,
  getAllWatchProgress,
  loadWatchProgress,
  shouldResume,
  type WatchProgress
} from "@/lib/watchProgress";

type QuickTool = {
  icon: AppIconName;
  tint: string;
  tintBg: string;
  tag: string;
  title: string;
  desc: string;
  href: string;
};

const QUICK_TOOLS: QuickTool[] = [
  {
    icon: "headphones",
    tint: colors.brand700,
    tintBg: colors.brand50,
    tag: "30s 盲听",
    title: "听力精听",
    desc: "分段反复听 + 找漏听词",
    href: "/listening"
  },
  {
    icon: "mic",
    tint: colors.indigo600,
    tintBg: colors.indigo50,
    tag: "AI 对话",
    title: "口语练习",
    desc: "情景西语对话 + 纠正表达",
    href: "/talk"
  },
  {
    icon: "grammar",
    tint: colors.amber700,
    tintBg: colors.amber50,
    tag: "人称/时态",
    title: "语法知识库",
    desc: "变位规律与句型随时查",
    href: "/grammar"
  },
  {
    icon: "phonics",
    tint: colors.sky600,
    tintBg: colors.sky50,
    tag: "A1 入门",
    title: "字母发音",
    desc: "西语拼读与重音规则",
    href: "/phonics"
  }
];

const BUCKET_COLORS = ["#D6EFE3", "#A7DFC6", "#5EC79B", colors.brand600];

/**
 * 首页 = 泛听泛读出发台。
 *
 * 视觉重心：
 * 1. 今日主卡片：优先衔接最近观看的视频（泛听），附带「顺便复习」轻量引导；
 * 2. 最近观看横滑 + 我的书架快捷入口；
 * 3. 2x2 专项工具网格（替代原来冗长的 9 行列表，消灭与「我的」的重复）；
 * 4. 词库概览轻卡（点一下直接进 复习 -> 我的词库）。
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [due, setDue] = useState<number | null>(null);
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [progress, setProgress] = useState<Record<string, WatchProgress>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    await loadWatchProgress();

    const [queueRes, statsRes, historyRes] = await Promise.allSettled([
      fetchReviewQueue(),
      fetchVocabStats(),
      fetchWatchHistory(6)
    ]);

    if (queueRes.status === "fulfilled") setDue(queueRes.value.totalDue ?? 0);
    if (statsRes.status === "fulfilled") setStats(statsRes.value);

    if (historyRes.status === "fulfilled") {
      setHistory(historyRes.value);
      historyRes.value.forEach((item) => {
        if (typeof item.position === "number" && item.position > 0) {
          adoptServerProgress(item.videoId, item.position, item.duration ?? 0);
        }
      });
    }

    setProgress(getAllWatchProgress());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const totalSaved = stats?.totalSaved ?? 0;
  const weeklyNew = stats?.weeklyNew ?? 0;
  const buckets = stats?.encounterBuckets ?? [];
  const mastered = buckets.find((b) => b.label.includes("6"))?.count ?? 0;
  const bucketTotal = buckets.reduce((sum, b) => sum + b.count, 0);

  const resumeItem = history[0] ?? null;
  const resumeSaved = resumeItem ? progress[resumeItem.videoId] : undefined;
  const canResume = Boolean(resumeItem && shouldResume(resumeSaved));

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
        {/* 顶栏 */}
        <View style={styles.brandRow}>
          <Text style={styles.brand}>
            LinguaMind<Text style={styles.brandDot}>.</Text>
          </Text>
          <View style={styles.topActions}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/lectura", params: { tab: "shelf" } } as never)
              }
              style={({ pressed }) => [styles.topPill, pressed && styles.pressed]}
            >
              <AppIcon color={colors.textSecondary} name="shelf" size={14} />
              <Text style={styles.topPillText}>书架</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/search" as never)}
              style={({ pressed }) => [styles.topPill, pressed && styles.pressed]}
            >
              <AppIcon color={colors.textSecondary} name="search" size={14} />
              <Text style={styles.topPillText}>搜视频</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.hello}>
          {user?.name ? `Hola, ${user.name}` : "Hola"} · 今天逛点什么？
        </Text>

        {/* 主引导卡：泛听泛读优先 + 温和复习联动 */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>IMMERSION · 泛听泛读</Text>
          {canResume && resumeItem ? (
            <>
              <Text numberOfLines={2} style={styles.heroTitle}>
                继续：{resumeItem.title}
              </Text>
              <Text style={styles.heroSub}>
                {resumeItem.channelTitle} · 上次看到{" "}
                {resumeSaved ? formatPosition(resumeSaved.position) : "开头"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>看一条西语视频，或读一篇短文</Text>
              <Text style={styles.heroSub}>
                双语字幕与阅读正文都支持轻触查词、查看完整动词变位。
              </Text>
            </>
          )}

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => {
                if (canResume && resumeItem) {
                  router.push({
                    pathname: "/watch/[videoId]",
                    params: {
                      videoId: resumeItem.videoId,
                      title: resumeItem.title,
                      channelTitle: resumeItem.channelTitle,
                      thumbnail: resumeItem.thumbnail ?? ""
                    }
                  } as never);
                } else {
                  router.push("/watch" as never);
                }
              }}
              style={({ pressed }) => [styles.heroPrimaryBtn, pressed && styles.pressed]}
            >
              <AppIcon color={colors.brand700} name="play" size={14} />
              <Text style={styles.heroPrimaryText}>
                {canResume ? "继续观看" : "去看视频"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/review" as never)}
              style={({ pressed }) => [styles.heroGhostBtn, pressed && styles.pressed]}
            >
              {loading && due === null ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.heroGhostText}>
                  {due && due > 0 ? `待复习 ${due} 词` : "去复习 / 词库"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* 最近观看 */}
        {history.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>接着看</Text>
              <Pressable onPress={() => router.push("/watch" as never)}>
                <Text style={styles.sectionMore}>全部视频 ›</Text>
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.historyRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {history.map((item) => {
                const saved = progress[item.videoId];
                const resumable = shouldResume(saved);
                const pct =
                  resumable && saved && saved.duration > 0
                    ? Math.min(100, (saved.position / saved.duration) * 100)
                    : 0;

                return (
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
                    {resumable && saved ? (
                      <View style={styles.historyProgressRow}>
                        <View style={styles.historyProgressTrack}>
                          <View
                            style={[styles.historyProgressFill, { width: `${Math.max(4, pct)}%` }]}
                          />
                        </View>
                        <Text style={styles.historyProgressText}>
                          看到 {formatPosition(saved.position)}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 2x2 专项工具与训练 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>专项训练与参考</Text>
            <Pressable
              onPress={() => router.push("/lectura" as never)}
            >
              <Text style={styles.sectionMore}>读短文 / 书架 ›</Text>
            </Pressable>
          </View>

          <View style={styles.toolGrid}>
            {QUICK_TOOLS.map((tool) => (
              <Pressable
                key={tool.title}
                onPress={() => router.push(tool.href as never)}
                style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}
              >
                <View style={styles.toolTop}>
                  <View style={[styles.toolIconBox, { backgroundColor: tool.tintBg }]}>
                    <AppIcon color={tool.tint} name={tool.icon} size={17} />
                  </View>
                  <Text style={styles.toolTag}>{tool.tag}</Text>
                </View>
                <Text style={styles.toolTitle}>{tool.title}</Text>
                <Text numberOfLines={2} style={styles.toolDesc}>
                  {tool.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 词汇资产轻卡 */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/review", params: { tab: "vocab" } } as never)
          }
          style={({ pressed }) => [styles.vocabCard, pressed && styles.pressed]}
        >
          <View style={styles.vocabHead}>
            <Text style={styles.vocabTitle}>我的词汇积累</Text>
            <Text style={styles.vocabLink}>查看词库 ›</Text>
          </View>

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

          {bucketTotal > 0 ? (
            <>
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
            </>
          ) : null}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  brand: { fontSize: 21, fontWeight: "800", letterSpacing: -0.6, color: colors.text },
  brandDot: { color: colors.brand500 },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  topPillText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  pressed: { opacity: 0.78 },
  hello: {
    marginTop: spacing.lg,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.text
  },
  heroCard: {
    marginTop: spacing.md,
    backgroundColor: colors.brand600,
    borderRadius: radius.xl,
    padding: spacing.lg + 2,
    gap: 6
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.8)"
  },
  heroTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: "#fff"
  },
  heroSub: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "rgba(255,255,255,0.86)"
  },
  heroActions: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  heroPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand700
  },
  heroGhostBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  heroGhostText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff"
  },
  section: { marginTop: spacing.xl },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm + 2
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  sectionMore: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  historyRow: { gap: spacing.md, paddingRight: spacing.md },
  historyCard: {
    width: 172,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8
  },
  historyThumb: { width: "100%", height: 90, borderRadius: radius.sm - 2, backgroundColor: "#000" },
  historyThumbEmpty: { backgroundColor: colors.surfaceMuted },
  historyTitle: {
    marginTop: 7,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 17,
    color: colors.text
  },
  historyChannel: { marginTop: 2, fontSize: 10.5, color: colors.textTertiary },
  historyProgressRow: { marginTop: 6, gap: 3 },
  historyProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  historyProgressFill: { height: 3, borderRadius: 2, backgroundColor: colors.brand500 },
  historyProgressText: { fontSize: 10, fontWeight: "600", color: colors.brand600 },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md
  },
  toolCard: {
    width: "48.3%",
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    gap: 6
  },
  toolTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  toolIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  toolTag: {
    fontSize: 10.5,
    fontWeight: "600",
    color: colors.textTertiary
  },
  toolTitle: {
    marginTop: 2,
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.text
  },
  toolDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary
  },
  vocabCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  vocabHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  vocabTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  vocabLink: { fontSize: 12, fontWeight: "600", color: colors.brand600 },
  statRow: {
    flexDirection: "row"
  },
  statCell: { flex: 1, alignItems: "center", gap: 3 },
  statCellMiddle: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  statLabel: { fontSize: 11, color: colors.textTertiary },
  bucketBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 10.5, color: colors.textSecondary }
});
