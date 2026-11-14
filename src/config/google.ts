/**
 * Google 登录配置。
 *
 * 这些 ID 不是秘密(打包进 APK 也无所谓),真正保密的是服务端的 client_secret,
 * 而 App 流程根本用不到它 —— id_token 由 Google 签名,服务端验签。
 *
 * 获取方式(Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Android):
 *   包名:cn.pcmuz.esponal
 *   SHA-1:5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
 *   (这是当前 APK 的 debug keystore 指纹;将来换正式签名要再建一个 client 或补指纹)
 *
 * Web client ID 可选:只在需要走浏览器兜底流程时用到。
 *
 * 填法二选一,环境变量优先:
 *   1) 构建环境里设 EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID(推荐,不用改代码)
 *   2) 直接把字符串填到下面的常量里
 */

/** 允许构建期用 EXPO_PUBLIC_* 覆盖,免得为了一个 id 改代码再提交 */
const ENV_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const ENV_IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const ENV_WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/** 代码里直接写死时填这里 */
const HARD_ANDROID = "";
const HARD_IOS = "";
const HARD_WEB = "";

export const GOOGLE_ANDROID_CLIENT_ID = (HARD_ANDROID || ENV_ANDROID).trim();
export const GOOGLE_IOS_CLIENT_ID = (HARD_IOS || ENV_IOS).trim();
export const GOOGLE_WEB_CLIENT_ID = (HARD_WEB || ENV_WEB).trim();

/** 没填 client id 时,登录页把 Google 按钮置灰并提示,而不是点了报错 */
export const isGoogleConfigured = Boolean(
  GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
);
