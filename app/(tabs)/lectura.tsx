// Timestamp: 2026-11-13 23:32
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";

import { fetchStories, type LecturaListItem, type LecturaLevel } from "@/api/lectura";
import { colors, radius, spacing } from "@/theme";

const LEVELS: Array<LecturaLevel | "ALL"> = ["ALL", "A1", "A2", "B1"];

const LEVEL_LABEL: Record<LecturaLevel | "ALL", string> = {
  ALL: "全部",
  A1: "A1 入门",
  A2: "A2 基础",
  B1: "B1 进阶"
};

export default function LecturaScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LecturaListItem[]>([]);
  const [level, setLevel] = useState<LecturaLevel | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await fetchStories();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (level === "ALL" ? items : items.filter((item) => item.level === level)),
    [items, level]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.slug}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand500} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => load()} style={styles.retry}>
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>这个难度还没有文章</Text>
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Lectura</Text>
            <Text style={styles.title}>阅读</Text>
            <Text style={styles.subtitle}>
              分级短文,点任意单词查词。读过的会留标记。
            </Text>

            <View style={styles.chips}>
              {LEVELS.map((item) => {
                const on = level === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setLevel(item)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {LEVEL_LABEL[item]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            colors={[colors.brand500]}
            onRefresh={() => load(true)}
            refreshing={refreshing}
            tintColor={colors.brand500}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/lectura/[slug]",
                params: { slug: item.slug }
              } as never)
            }
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.badges}>
              <Text style={styles.levelBadge}>{item.level}</Text>
              <Text style={styles.metaText}>
                {item.durationMin} 分钟 · {item.paragraphCount} 段
              </Text>
              {item.isRead ? <Text style={styles.readBadge}>已读</Text> : null}
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTitleZh}>{item.titleZh}</Text>
            <Text numberOfLines={2} style={styles.cardSummary}>
              {item.summaryZh}
            </Text>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md
  },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brand600
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.text
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 21,
    color: colors.textSecondary
  },
  chips: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border
  },
  chipOn: {
    backgroundColor: colors.brand500,
    borderColor: colors.brand500
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  chipTextOn: { color: "#fff" },
  center: {
    paddingVertical: 60,
    alignItems: "center",
    gap: spacing.md
  },
  errorText: { fontSize: 13, color: colors.danger, textAlign: "center" },
  emptyText: { fontSize: 13, color: colors.textTertiary },
  retry: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brand500
  },
  retryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  cardPressed: { backgroundColor: colors.surfaceMuted },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  levelBadge: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.brand700,
    backgroundColor: colors.brand50,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  metaText: { fontSize: 11, color: colors.textTertiary },
  readBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textTertiary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: colors.text
  },
  cardTitleZh: {
    marginTop: 2,
    fontSize: 12.5,
    color: colors.textSecondary
  },
  cardSummary: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.textTertiary
  }
});
