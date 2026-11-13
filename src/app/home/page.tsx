// Timestamp: 2026-11-13 14:40
import { redirect } from "next/navigation";

/**
 * MOBILE-R2-001 真机反馈修正:首页 tab 即 "/"(登录后仪表盘)。
 * /home 只作旧链接兼容,一律重定向到 /,不再维护第二份首页内容。
 */
export default function MobileHomePage() {
  redirect("/");
}
