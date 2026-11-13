// Timestamp: 2026-11-13 13:40
import { BookOpen, Home, Play, RotateCcw, User, type LucideIcon } from "lucide-react";

export type ShellRouteLevel = "tab" | "push" | "sheet";
export type ShellTabPath = "/" | "/watch" | "/lectura" | "/review" | "/me";

export type ShellRoute = {
  path: string;
  label: string;
  level: ShellRouteLevel;
  parentTab: ShellTabPath;
  Icon?: LucideIcon;
};

/**
 * 五个一级 tab。壳里的底栏就是这张表,别处不许再写第二份导航。
 */
export const shellTabRoutes: ShellRoute[] = [
  // 首页 tab 就是登录后仪表盘 "/"(MOBILE-R2-001 真机反馈:此前 / 被登记成 push,
  // 顶栏是 logo、底栏却隐藏,用户掉进导航真空)。/home 仅作旧链接兼容,重定向到 /。
  { path: "/", label: "首页", level: "tab", parentTab: "/", Icon: Home },
  { path: "/watch", label: "视频", level: "tab", parentTab: "/watch", Icon: Play },
  { path: "/lectura", label: "阅读", level: "tab", parentTab: "/lectura", Icon: BookOpen },
  { path: "/review", label: "复习", level: "tab", parentTab: "/review", Icon: RotateCcw },
  { path: "/me", label: "我的", level: "tab", parentTab: "/me", Icon: User },
];

/**
 * 推入页:底栏隐藏,顶栏 = 返回箭头 + 标题。
 * 顺序有意义:具体路径必须排在 `[slug]` 之前。
 */
export const shellPushRoutes: ShellRoute[] = [
  { path: "/import/library", label: "我的导入", level: "push", parentTab: "/lectura" },
  { path: "/import/[id]", label: "导入阅读", level: "push", parentTab: "/lectura" },
  { path: "/import", label: "导入", level: "push", parentTab: "/lectura" },
  { path: "/lectura/[slug]", label: "短文阅读", level: "push", parentTab: "/lectura" },
  { path: "/vocab/review", label: "复习队列", level: "push", parentTab: "/review" },
  { path: "/vocab", label: "语料库", level: "push", parentTab: "/" },
  { path: "/account/credits", label: "积分账户", level: "push", parentTab: "/me" },
  { path: "/membership", label: "会员", level: "push", parentTab: "/me" },
  { path: "/settings", label: "设置", level: "push", parentTab: "/me" },
  { path: "/learn/phase-1", label: "第一阶词汇", level: "push", parentTab: "/" },
  { path: "/learn/foundation/[day]", label: "基础课程", level: "push", parentTab: "/" },
  { path: "/learn/foundation", label: "基础课程", level: "push", parentTab: "/" },
  { path: "/learn/[slug]", label: "课程", level: "push", parentTab: "/" },
  { path: "/learn", label: "学习路线", level: "push", parentTab: "/" },
  { path: "/talk/[characterId]", label: "对话", level: "push", parentTab: "/" },
  { path: "/talk", label: "AI 对话", level: "push", parentTab: "/" },
  { path: "/phonics", label: "字母发音", level: "push", parentTab: "/" },
  { path: "/grammar/[slug]", label: "语法", level: "push", parentTab: "/" },
  { path: "/grammar", label: "语法", level: "push", parentTab: "/" },
  { path: "/dissect", label: "拆解", level: "push", parentTab: "/" },
  { path: "/search", label: "搜索", level: "push", parentTab: "/" },
  { path: "/extension", label: "浏览器扩展", level: "push", parentTab: "/" },
  { path: "import-sheet", label: "导入", level: "sheet", parentTab: "/" },
];

export const shellRoutes: ShellRoute[] = [...shellTabRoutes, ...shellPushRoutes];

/** 这些路由完全不要壳(登录、离线),避免顶栏底栏插进流程中间。 */
export const shellHiddenPrefixes = ["/auth", "/offline"];

function routePatternToRegex(path: string) {
  const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\[.+?\\\]/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
}

function normalizePath(pathname: string) {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function getShellRouteForPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return shellRoutes.find((route) => routePatternToRegex(route.path).test(normalized)) ?? null;
}

export function getParentTabForPath(pathname: string): ShellTabPath {
  return getShellRouteForPath(pathname)?.parentTab ?? "/";
}

export function isShellHiddenPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return shellHiddenPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/**
 * 沉浸页:顶栏与底栏全部退场,只留内容。
 * 视频播放是 `/watch?v=<id>`(同路由不同 query),所以必须看 searchParams。
 */
export function isImmersivePath(pathname: string, videoId?: string | null) {
  if (normalizePath(pathname) !== "/watch") return false;
  return Boolean(videoId);
}
