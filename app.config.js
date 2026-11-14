/**
 * 动态配置:在 app.json 的静态配置之上补一点构建期才确定的东西。
 *
 * 目前只做一件事 —— 把 Google 原生登录的回跳 scheme 加进 AndroidManifest。
 *
 * 为什么需要它:
 *   Expo 的 Google OAuth 走的是「浏览器内授权 + 自定义 scheme 回跳」,
 *   回跳地址固定是 com.googleusercontent.apps.<clientId 反写>:/oauthredirect。
 *   这个 scheme 必须注册在 AndroidManifest 的 intent-filter 里,否则授权完
 *   App 回不来,表现为「登录后停在浏览器白页」。
 *
 * 为什么不写死在 app.json:
 *   scheme 的后半段来自 client id,client id 是用户去 Google Cloud Console
 *   建完才有的。用环境变量注入,就不用为了一个 id 改代码再提交。
 *
 * 用法:
 *   构建时设 EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxx.apps.googleusercontent.com
 *   没设就退化成只有 "esponal" 一个 scheme,其它功能不受影响。
 */
const baseConfig = require("./app.json");

/** 客户端 id 反写:123-abc.apps.googleusercontent.com -> com.googleusercontent.apps.123-abc */
function googleRedirectScheme(clientId) {
  const id = (clientId || "").trim();
  if (!id) return null;
  const parts = id.split(".");
  if (parts.length < 3 || !id.endsWith("googleusercontent.com")) return null;
  return parts.reverse().join(".");
}

module.exports = ({ config }) => {
  const merged = { ...(config || baseConfig.expo) };

  const schemes = new Set();
  const existing = merged.scheme;
  if (Array.isArray(existing)) existing.filter(Boolean).forEach((s) => schemes.add(s));
  else if (typeof existing === "string" && existing) schemes.add(existing);

  const googleScheme = googleRedirectScheme(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  if (googleScheme) schemes.add(googleScheme);

  merged.scheme = Array.from(schemes);
  return merged;
};
