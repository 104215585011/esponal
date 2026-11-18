// Timestamp: 2026-11-18 10:58
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ADMIN_FEATURES } from "@/lib/admin-input";

type UserRow = { id: string; name: string | null; email: string | null; plan: string; planExpiresAt: string | null; creditBalanceMinor: number; featurePolicies: { feature: string; enabled: boolean; dailyLimit: number | null }[] };
type Usage = {
  since: string | null;
  groups: { provider: string; feature: string; origin: string; outcome: string; unit: string | null; _count: { _all: number }; _sum: { units: number | null } }[];
  budgets: { provider: string; unit: string; used: number | null; remaining: number | null; unmetered: number; quota?: { allowance: number; baseline: number; resetAt: string; updatedAt: string; usdPerThousand: number | null } }[];
};
type Audit = { id: string; actorId: string; target: string; action: string; reason: string; before: unknown; after: unknown; createdAt: string };
type View = "usage" | "users" | "audit";
const views: Record<View, string> = { usage: "API 用量", users: "用户管理", audit: "操作记录" };
const labels: Record<string, string> = { supadata: "Supadata", youtube: "YouTube 数据", youtube_search: "YouTube 搜索", deepseek: "DeepSeek", dashscope: "阿里云百炼", fish: "Fish Audio", whisper: "Whisper", edge: "Edge 朗读", cache: "缓存", success: "成功", error: "失败", network_error: "网络错误", rate_limited: "已限流", quota_or_plan: "额度或套餐受限", hit: "命中", usage: "流式用量", user: "已登录用户", guest: "访客", background: "后台", credits: "调整积分", extend: "延长会员", policy: "功能权限", quota: "供应商额度" };
const title = (code: string) => labels[code] ?? code;
const date = (value?: string | null) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "—";
const usd = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const primary = "rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const secondary = "rounded-lg border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700";

async function request<T>(query: string, input?: unknown): Promise<T> {
  const response = await fetch("/api/admin/manage" + query, {
    cache: "no-store",
    ...(input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {})
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `请求失败（${response.status}）`);
  return result as T;
}

export function AdminDashboard() {
  const [view, setView] = useState<View>("usage");
  const [period, setPeriod] = useState("day");
  const [provider, setProvider] = useState("");
  const [usageUser, setUsageUser] = useState<UserRow | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [actions, setActions] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const path = `?view=${view}&period=${period}&q=${encodeURIComponent(query)}&userId=${encodeURIComponent(usageUser?.id ?? "")}`;
    const pending = view === "usage" ? request<Usage>(path).then((data) => { if (active) setUsage(data); }) :
      view === "users" ? request<{ users: UserRow[] }>(path).then((data) => { if (active) setUsers(data.users); }) :
      request<{ actions: Audit[] }>(path).then((data) => { if (active) setActions(data.actions); });
    pending.catch((err: Error) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, period, query, usageUser, refresh]);

  const save = useCallback(async (input: unknown) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await request("", input);
      setNotice("已保存。");
      setRefresh((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const user = users.find((item) => item.id === selected);
  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-9 text-sm text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-brand-700 dark:text-brand-300">返回 LinguaMind</Link>
        <h1 className="mt-3 text-3xl font-bold">管理后台</h1>
        <nav aria-label="管理功能" className="my-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          {(Object.keys(views) as View[]).map((item) => (
            <button key={item} type="button" aria-pressed={view === item} className={view === item ? primary : secondary}
              onClick={() => { setView(item); setNotice(""); }}>{views[item]}</button>
          ))}
          <button type="button" className={secondary} onClick={() => setRefresh((value) => value + 1)}>刷新</button>
        </nav>
        {notice && <p role="status" className="mb-3 text-brand-700 dark:text-brand-300">{notice}</p>}
        {error && <p role="alert" className="mb-3 text-red-700 dark:text-red-300">{error}</p>}
        {loading && <p role="status" className="mb-3 text-zinc-500">加载中…</p>}
        {view === "usage" && <>
          <div className="flex flex-wrap items-center gap-3">
            <select aria-label="统计周期" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border bg-transparent p-2">
              <option value="day">今日</option><option value="month">本月</option>
            </select>
            <select aria-label="供应商" value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border bg-transparent p-2">
              <option value="">全部供应商</option>
              {Array.from(new Set([...(usage?.budgets ?? []).map((item) => item.provider), ...(usage?.groups ?? []).map((item) => item.provider)])).map((name) => <option key={name} value={name}>{title(name)}</option>)}
            </select>
            {usageUser && <button className={secondary} onClick={() => setUsageUser(null)}>用户：{usageUser.email ?? usageUser.id} ×</button>}
          </div>
          {usage && <>
            <p className="my-4 text-zinc-600 dark:text-zinc-400">北京时间 · 自 {date(usage.since)} 开始记录。供应商余额按手动登记与本站用量估算。</p>
            <div className="overflow-x-auto border-y border-zinc-200 dark:border-zinc-800">
              <table className="w-full whitespace-nowrap text-left">
                <thead><tr>{["来源", "功能", "触发方", "结果", "次数", "记录用量", "估算费用"].map((item) => <th scope="col" key={item} className="p-3">{item}</th>)}</tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {usage.groups.filter((item) => !provider || item.provider === provider).map((item) => (
                    <tr key={JSON.stringify([item.provider, item.feature, item.origin, item.outcome, item.unit])}>
                      <td className="p-3">{title(item.provider)}</td><td className="p-3">{item.feature}</td>
                      <td className="p-3">{title(item.origin)}</td><td className="p-3">{title(item.outcome)}</td>
                      <td className="p-3">{item.outcome === "usage" ? "—" : item._count._all}</td><td className="p-3">{item._sum.units === null ? "—" : `${item._sum.units} ${item.unit}`}</td>
                      <td className="p-3">{formatCost(usage, item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!usage.groups.some((item) => !provider || item.provider === provider) && <p className="p-3 text-zinc-500">当前筛选下暂无记录。</p>}
            </div>
            <section className="mt-8"><h2 className="mb-3 text-xl font-semibold">供应商额度</h2>
              {usage.budgets.filter((item) => !provider || item.provider === provider).map((row) => <QuotaForm key={row.provider} row={row} busy={busy} save={save} />)}
            </section>
          </>}
        </>}
        {view === "users" && <>
          <form className="flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); setSelected(""); setQuery(search); setRefresh((value) => value + 1); }}>
            <input className={field} type="search" aria-label="邮箱或姓名" placeholder="邮箱或姓名" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className={primary}>搜索</button>
          </form>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((item) => <li key={item.id}><button onClick={() => setSelected(item.id)} aria-pressed={selected === item.id} className="w-full rounded px-3 py-3 text-left aria-pressed:bg-brand-100 dark:aria-pressed:bg-brand-950">
                <span className="block font-semibold">{item.email || item.name || item.id}</span><span className="text-zinc-500">{item.plan} · {item.creditBalanceMinor / 100} 积分</span>
              </button></li>)}
              {!loading && !users.length && <li className="py-3 text-zinc-500">没有找到用户。</li>}
            </ul>
            {user && <UserForm key={user.id} user={user} busy={busy} save={save} onUsage={() => { setUsageUser(user); setView("usage"); }} />}
          </div>
        </>}
        {view === "audit" && <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {actions.map((action) => <li key={action.id} className="py-4">
            <p className="font-semibold">{title(action.action)} · {action.target}</p>
            <p className="my-1 text-zinc-500">{date(action.createdAt)} · 操作账号 {action.actorId}</p>
            <p>原因　{action.reason}</p>
            <details className="mt-2"><summary>查看修改前后</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">修改前　{JSON.stringify(action.before)}{"\n"}修改后　{JSON.stringify(action.after)}</pre>
            </details>
          </li>)}
          {!loading && !actions.length && <li className="py-3 text-zinc-500">暂无管理操作。</li>}
        </ul>}
      </div>
    </main>
  );
}

function formatCost(usage: Usage, item: Usage["groups"][number]) {
  const rate = usage.budgets.find((row) => row.provider === item.provider && row.unit === item.unit)?.quota?.usdPerThousand;
  return rate == null || item._sum.units === null ? "—" : usd.format(item._sum.units * rate / 1000);
}

function QuotaForm({ row, busy, save }: { row: Usage["budgets"][number]; busy: boolean; save: (value: unknown) => Promise<void> }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const resetAt = new Date(String(data.get("resetAt")) + ":00+08:00").toISOString();
    const rate = data.get("rate");
    void save({ action: "quota", provider: row.provider, allowance: Number(data.get("allowance")), baseline: Number(data.get("baseline")), resetAt, reason: data.get("reason"), usdPerThousand: rate ? Number(rate) : null });
  }
  return <details className="border-t border-zinc-200 py-3 dark:border-zinc-800">
    <summary className="cursor-pointer font-medium">
      {title(row.provider)} · {row.used === null ? "本周期额度待登记" : `已用约 ${row.used} / ${row.quota?.allowance} ${row.unit} · 余量约 ${row.remaining}`}
      {row.used !== null && row.quota && row.used / row.quota.allowance >= 0.8 &&
        <span className="ml-2 text-amber-700 dark:text-amber-300">{row.remaining === 0 ? "已达上限" : "接近上限"}</span>}
    </summary>
    {row.quota && <p className="mt-2 text-zinc-500">登记于 {date(row.quota.updatedAt)} · {date(row.quota.resetAt)} 重置 · {row.unmetered} 次未取得计量值</p>}
    <form onSubmit={submit} className="mt-3 grid items-end gap-3 md:grid-cols-4">
      <label>周期总额度<input className={field} name="allowance" type="number" required min="1" defaultValue={row.quota?.allowance} /></label>
      <label>截至现在已用<input className={field} name="baseline" type="number" required min="0" defaultValue={row.used ?? 0} /></label>
      <label>重置时间（北京时间）<input className={field} name="resetAt" type="datetime-local" required defaultValue={row.quota ? new Date(+new Date(row.quota.resetAt) + 8 * 3600000).toISOString().slice(0, 16) : ""} /></label>
      <label>登记原因<input className={field} name="reason" maxLength={300} required /></label>
      <label>每千单位美元估算价<input className={field} name="rate" type="number" min="0" step="any" defaultValue={row.quota?.usdPerThousand ?? ""} /></label>
      <button className={primary} disabled={busy}>保存额度</button>
    </form>
  </details>;
}

function UserForm({ user, busy, save, onUsage }: { user: UserRow; busy: boolean; save: (value: unknown) => Promise<void>; onUsage: () => void }) {
  const [action, setAction] = useState("credits");
  const [feature, setFeature] = useState<keyof typeof ADMIN_FEATURES>("talk");
  const rule = user.featurePolicies.find((item) => item.feature === feature);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = Number(data.get("value"));
    void save({ action, userId: user.id, reason: data.get("reason"), feature,
      enabled: data.get("enabled") === "on", limit: data.get("limit") ? Number(data.get("limit")) : null,
      value: action === "credits" ? Math.round(value * 100) : value });
  }
  return <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
    <h2 className="break-words text-lg font-semibold">{user.email || user.name || user.id}</h2>
    <p className="my-2 text-zinc-500">{user.plan} · {user.creditBalanceMinor / 100} 积分 · 到期 {date(user.planExpiresAt)}</p>
    <button type="button" className={secondary} onClick={onUsage}>查看该用户用量</button>
    <form onSubmit={submit} className="mt-5 grid gap-3">
      <label>操作<select className={field} value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="credits">调整积分</option><option value="extend">延长会员</option><option value="policy">调整功能权限</option>
      </select></label>
      {action === "policy" ? <>
        <label>功能<select className={field} value={feature} onChange={(e) => setFeature(e.target.value as typeof feature)}>
          {Object.entries(ADMIN_FEATURES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <fieldset key={JSON.stringify([feature, rule])} className="grid gap-3">
          <label><input name="enabled" type="checkbox" defaultChecked={rule?.enabled ?? true} /> 允许使用</label>
          <label>每日上限<input className={field} type="number" min="1" max="100000" name="limit" placeholder="不限" defaultValue={rule?.dailyLimit ?? ""} /></label>
        </fieldset>
      </> : <label key={action}>{action === "credits" ? "积分改变量（负数扣减）" : "延长天数"}<input className={field} type="number" step={action === "credits" ? ".01" : "1"} min={action === "extend" ? "1" : undefined} required name="value" /></label>}
      <label>调整原因<input className={field} name="reason" maxLength={300} required /></label>
      <button className={primary} disabled={busy}>保存调整</button>
    </form>
  </section>;
}
