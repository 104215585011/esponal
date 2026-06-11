// Timestamp: 2026-06-11 11:05
import { BookOpen, Home, Play, RotateCcw, User, type LucideIcon } from "lucide-react";

export type ShellRouteLevel = "tab" | "push" | "sheet";
export type ShellTabPath = "/home" | "/watch" | "/lectura" | "/review" | "/me";

export type ShellRoute = {
  path: string;
  label: string;
  level: ShellRouteLevel;
  parentTab: ShellTabPath;
  Icon?: LucideIcon;
};

export const shellTabRoutes: ShellRoute[] = [
  { path: "/home", label: "首页", level: "tab", parentTab: "/home", Icon: Home },
  { path: "/watch", label: "视频", level: "tab", parentTab: "/watch", Icon: Play },
  { path: "/lectura", label: "阅读", level: "tab", parentTab: "/lectura", Icon: BookOpen },
  { path: "/review", label: "复习", level: "tab", parentTab: "/review", Icon: RotateCcw },
  { path: "/me", label: "我的", level: "tab", parentTab: "/me", Icon: User },
];

export const shellRoutes: ShellRoute[] = [
  ...shellTabRoutes,
  { path: "/watch", label: "视频", level: "push", parentTab: "/watch" },
  { path: "/import/[id]", label: "导入阅读", level: "push", parentTab: "/lectura" },
  { path: "/lectura/[slug]", label: "短文阅读", level: "push", parentTab: "/lectura" },
  { path: "/account/credits", label: "积分账户", level: "push", parentTab: "/me" },
  { path: "/membership", label: "会员", level: "push", parentTab: "/me" },
  { path: "/settings", label: "设置", level: "push", parentTab: "/me" },
  { path: "import-sheet", label: "导入", level: "sheet", parentTab: "/home" },
];

function routePatternToRegex(path: string) {
  const pattern = path
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[.+?\\\]/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
}

export function getShellRouteForPath(pathname: string) {
  return shellRoutes.find((route) => routePatternToRegex(route.path).test(pathname)) ?? null;
}

export function getParentTabForPath(pathname: string): ShellTabPath {
  return getShellRouteForPath(pathname)?.parentTab ?? "/home";
}
