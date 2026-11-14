/**
 * 动态配置:在 app.json 的静态配置之上补一点构建期才确定的东西。
 *
 * 目前只做一件事 —— Google 登录相关的两处注入:
 *   1. 把回跳 scheme 写进 AndroidManifest
 *   2. 把 client id 放进 extra,供 src/config/google.ts 运行时读取
 *
 * ★ client id 的唯一来源就在下面这个常量(环境变量优先)。
 *   它是公开信息(每个 APK 里都能翻出来),不是密钥。
 *
 * 为什么需要回跳 scheme:
 *   Expo 的 Google OAuth 走「浏览器内授权 + 自定义 scheme 回跳」,
 *   回跳地址固定是 com.googleusercontent.apps.<clientId 反写>:/oauthredirect。
 *   这个 scheme 必须注册进 AndroidManifest,否则授权完 App 回不来(停在浏览器白页)。
 *
 * 为什么用 extra 而不是在两处各写一遍 id:
 *   src/config/google.ts 是 TS,app.config.js 是 JS,没法直接 import 同一个常量。
 *   走 extra 可以保证「只在 app.config.js 写一次」,TS 侧运行时读同一个值。
 */
const baseConfig = require("./app.json");

/** 没有环境变量时用这个(Google Cloud Console 建的 Android client) */
const FALLBACK_GOOGLE_ANDROID_CLIENT_ID =
  "944314756480-p5qqusb05evjcbf18dhvk8prril23onv.apps.googleusercontent.com";

/** 客户端 id 反写:123-abc.apps.googleusercontent.com -> com.googleusercontent.apps.123-abc */
function googleRedirectScheme(clientId) {
  const id = (clientId || "").trim();
  if (!id) return null;
  if (!id.endsWith("googleusercontent.com")) return null;
  const parts = id.split(".");
  if (parts.length < 3) return null;
  return parts.reverse().join(".");
}

module.exports = ({ config }) => {
  const merged = { ...(config || baseConfig.expo) };

  const clientId = (
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || FALLBACK_GOOGLE_ANDROID_CLIENT_ID
  ).trim();

  const schemes = new Set();
  const existing = merged.scheme;
  if (Array.isArray(existing)) existing.filter(Boolean).forEach((s) => schemes.add(s));
  else if (typeof existing === "string" && existing) schemes.add(existing);

  const googleScheme = googleRedirectScheme(clientId);
  if (googleScheme) schemes.add(googleScheme);

  merged.scheme = Array.from(schemes);
  merged.extra = { ...(merged.extra || {}), googleAndroidClientId: clientId };

  return merged;
};
