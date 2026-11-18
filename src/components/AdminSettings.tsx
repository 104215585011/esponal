// Timestamp: 2026-11-18 10:58
import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE, apiFetch } from "@/api/client";
import { colors, radius, spacing } from "@/theme";

type Page = "usage" | "users" | "audit";
type Policy = { feature: string; enabled: boolean; dailyLimit: number | null };
type ManagedUser = {
  id: string; name: string | null; email: string | null; plan: string;
  planExpiresAt: string | null; creditBalanceMinor: number; featurePolicies: Policy[];
};
type Usage = {
  since: string | null;
  groups: { provider: string; feature: string; outcome: string; unit: string | null; _count: { _all: number }; _sum: { units: number | null } }[];
  budgets: { provider: string; unit: string; used: number | null; remaining: number | null; quota?: { allowance: number } }[];
};
type AuditEntry = { id: string; target: string; action: string; reason: string; createdAt: string };
const labels: Record<Page, string> = { usage: "用量概览", users: "用户管理", audit: "最近管理操作" };
const features = { talk: "AI 对话", subtitle: "生成视频字幕", import: "导入文档" };
const changeLabels = { credits: "调整积分", extend: "延长会员", policy: "功能权限" };
const outcomes: Record<string, string> = { success: "成功", error: "失败", rate_limited: "限流", network_error: "网络失败", quota_or_plan: "额度或套餐受限", hit: "缓存命中", usage: "流式用量" };
const date = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN") : "—";

export function AdminSettings({ userId }: { userId: string }) {
  const [verified, setVerified] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [period, setPeriod] = useState("day");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    if (userId) apiFetch<{ isAdmin: boolean }>("/api/admin/me")
      .then((data) => { if (active) setVerified(data.isAdmin); })
      .catch(() => { if (active) setVerified(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!page || !verified) return;
    let active = true;
    setError("");
    setLoading(true);
    const endpoint = "/api/admin/manage?view=" + page + "&period=" + period + "&q=" + encodeURIComponent(query);
    const task = page === "usage" ? apiFetch<Usage>(endpoint).then((data) => { if (active) setUsage(data); }) :
      page === "users" ? apiFetch<{ users: ManagedUser[] }>(endpoint).then((data) => { if (active) setUsers(data.users); }) :
      apiFetch<{ actions: AuditEntry[] }>(endpoint).then((data) => { if (active) setAudit(data.actions); });
    task.catch((err: Error) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, period, query, refresh, verified]);

  async function save(input: unknown) {
    setSaving(true);
    try {
      await apiFetch("/api/admin/manage", { method: "POST", body: JSON.stringify(input) });
      setRefresh((value) => value + 1);
      Alert.alert("已保存");
    } catch (err) {
      Alert.alert("保存失败", err instanceof Error ? err.message : "请重试");
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setPage(null);
    setSelectedId("");
  }

  if (!verified || !userId) return null;
  const selected = users.find((item) => item.id === selectedId);
  return <>
    <Text style={styles.sectionTitle}>管理</Text>
    <View style={styles.card}>
      {(Object.keys(labels) as Page[]).map((item) => (
        <Pressable accessibilityRole="button" key={item} style={styles.row} onPress={() => setPage(item)}>
          <Text style={styles.label}>{labels[item]}</Text><Text style={styles.hint}>›</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" style={styles.row} onPress={() => {
        void Linking.openURL(API_BASE + "/admin").catch(() => Alert.alert("无法打开管理后台"));
      }}><Text style={styles.label}>打开完整管理后台</Text><Text style={styles.hint}>↗</Text></Pressable>
    </View>
    <Modal visible={page !== null} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{page ? labels[page] : "管理"}</Text>
          <Button label="关闭" onPress={close} />
        </View>
        <ScrollView contentContainerStyle={styles.contents} keyboardShouldPersistTaps="handled">
          {error ? <Text accessibilityRole="alert" style={styles.label}>{error}</Text> : null}
          {loading ? <Text style={styles.hint}>加载中…</Text> : null}
          {page === "usage" && <>
            <View style={styles.buttons}>
              <Button label={period === "day" ? "✓ 今日" : "今日"} onPress={() => setPeriod("day")} />
              <Button label={period === "month" ? "✓ 本月" : "本月"} onPress={() => setPeriod("month")} />
              <Button label="刷新" onPress={() => setRefresh((value) => value + 1)} />
            </View>
            <Text style={styles.hint}>北京时间 · 自 {date(usage?.since ?? null)} 开始记录</Text>
            {usage?.budgets.filter((item) => item.quota).map((item) => (
              <View key={item.provider} style={styles.entry}>
                <Text style={styles.label}>{item.provider}</Text>
                <Text style={styles.hint}>{item.used === null ? "额度周期已结束" : "已用约 " + item.used + " / " + item.quota?.allowance + " " + item.unit + " · 余量约 " + item.remaining}</Text>
              </View>
            ))}
            {usage?.groups.map((item, i) => (
              <View key={i} style={styles.entry}>
                <Text style={styles.label}>{item.provider} · {item.feature}</Text>
                <Text style={styles.hint}>{outcomes[item.outcome] ?? item.outcome} · {item.outcome === "usage" ? "用量报告" : item._count._all + " 次"}{item._sum.units === null ? "" : " · " + item._sum.units + " " + item.unit}</Text>
              </View>
            ))}
            {!loading && usage?.groups.length === 0 ? <Text style={styles.hint}>当前周期暂无记录。</Text> : null}
          </>}
          {page === "users" && <>
            {selected ? <>
              <Button label="返回搜索结果" onPress={() => setSelectedId("")} />
              <UserEditor key={selected.id} user={selected} onSave={save} saving={saving} />
            </> : <>
              <TextInput style={styles.input} accessibilityLabel="邮箱或姓名" placeholder="邮箱或姓名" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={search} onChangeText={setSearch} />
              <Button label="搜索" onPress={() => { setQuery(search); setRefresh((value) => value + 1); }} />
              {users.map((item) => <Pressable accessibilityRole="button" key={item.id} style={styles.entry} onPress={() => setSelectedId(item.id)}>
                <Text style={styles.label}>{item.email || item.name || item.id}</Text>
                <Text style={styles.hint}>{item.plan} · {item.creditBalanceMinor / 100} 积分</Text>
              </Pressable>)}
              {!loading && !users.length ? <Text style={styles.hint}>没有找到用户。</Text> : null}
            </>}
          </>}
          {page === "audit" && <>
            <Button label="刷新" onPress={() => setRefresh((value) => value + 1)} />
            {audit.map((item) => <View key={item.id} style={styles.entry}>
              <Text style={styles.label}>{changeLabels[item.action as keyof typeof changeLabels] ?? (item.action === "quota" ? "供应商额度" : item.action)} · {item.target}</Text>
              <Text style={styles.hint}>{date(item.createdAt)} · {item.reason}</Text>
            </View>)}
            {!loading && !audit.length ? <Text style={styles.hint}>暂无管理操作。</Text> : null}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}

function UserEditor({ user, onSave, saving }: { user: ManagedUser; onSave: (input: unknown) => Promise<void>; saving: boolean }) {
  const [action, setAction] = useState<keyof typeof changeLabels>("credits");
  const [feature, setFeature] = useState<keyof typeof features>("talk");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const rule = user.featurePolicies.find((item) => item.feature === feature);
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [limit, setLimit] = useState(rule?.dailyLimit?.toString() ?? "");

  function confirm() {
    const amount = Number(value);
    if (!reason.trim() || (action !== "policy" && (!value.trim() || !Number.isFinite(amount)))) {
      Alert.alert("请填写调整内容和原因");
      return;
    }
    const summary = action === "policy" ? features[feature] + " · " + (enabled ? "允许" : "暂停") + " · " + (limit ? "每日 " + limit : "不限") :
      changeLabels[action] + " · " + value;
    Alert.alert("确认调整", (user.email ?? user.id) + "\n" + summary + "\n" + reason.trim(), [
      { text: "取消", style: "cancel" },
      { text: "确认", onPress: () => { void onSave({
        action, userId: user.id, reason, feature, enabled, limit: limit.trim() ? Number(limit) : null,
        value: action === "credits" ? Math.round(amount * 100) : amount
      }); } }
    ]);
  }

  return <View style={styles.form}>
    <Text style={styles.title}>{user.email || user.name || user.id}</Text>
    <Text style={styles.hint}>{user.plan} · {user.creditBalanceMinor / 100} 积分 · 到期 {date(user.planExpiresAt)}</Text>
    <View style={styles.buttons}>
      {(Object.keys(changeLabels) as (keyof typeof changeLabels)[]).map((item) => <Button key={item} label={(action === item ? "✓ " : "") + changeLabels[item]} onPress={() => { setAction(item); setValue(""); }} />)}
    </View>
    {action === "policy" ? <>
      <View style={styles.buttons}>
        {(Object.keys(features) as (keyof typeof features)[]).map((item) => (
          <Button key={item} label={(feature === item ? "✓ " : "") + features[item]} onPress={() => {
            const next = user.featurePolicies.find((policy) => policy.feature === item);
            setFeature(item);
            setEnabled(next?.enabled ?? true);
            setLimit(next?.dailyLimit?.toString() ?? "");
          }} />
        ))}
      </View>
      <View style={styles.row}><Text style={styles.label}>允许使用</Text><Switch accessibilityLabel="允许使用" value={enabled} onValueChange={setEnabled} /></View>
      <TextInput style={styles.input} placeholder="每日上限，留空不限" accessibilityLabel="每日上限" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={limit} onChangeText={setLimit} />
    </> : <TextInput style={styles.input} accessibilityLabel={changeLabels[action]} placeholder={action === "credits" ? "积分改变量（负数扣减）" : "延长天数"} placeholderTextColor={colors.textSecondary} keyboardType="numbers-and-punctuation" value={value} onChangeText={setValue} />}
    <TextInput style={styles.input} accessibilityLabel="调整原因" placeholder="调整原因" placeholderTextColor={colors.textSecondary} maxLength={300} value={reason} onChangeText={setReason} />
    <Button label={saving ? "保存中…" : "确认调整"} onPress={confirm} disabled={saving} />
  </View>;
}

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={styles.button}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  header: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  contents: { padding: 16, gap: 12 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  hint: { fontSize: 13, color: colors.textSecondary },
  entry: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 4 },
  input: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 12, backgroundColor: colors.surface, color: colors.text },
  button: { backgroundColor: colors.brand50, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  buttonText: { color: colors.brand700, fontWeight: "600" },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  form: { gap: 12, paddingVertical: 8 }
});
