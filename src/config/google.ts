import Constants from "expo-constants";

/**
 * Google 登录配置。
 *
 * 这些 ID 不是秘密(打包进 APK 也无所谓),真正保密的是服务端的 client_secret,
 * 而 App 流程根本用不到它 —— id_token 由 Google 签名,服务端验签。
 *
 * client id 的唯一来源是 app.config.js(它会同时写进 scheme 和 extra),
 * 这里只负责读出来。这样「改 id」只需要动一个地方,不会出现
 * 「代码里有 id 但 AndroidManifest 里没有 scheme」的半配置状态。
 *
 * 获取方式(Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Android):
 *   包名:cn.pcmuz.esponal
 *   SHA-1:5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
 *   (当前 APK 的签名指纹;将来换正式签名要再建一个 client 或给现有 client 补指纹)
 *
 * 构建时也可用 EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID 覆盖(优先级高于代码里的默认值)。
 */

type Extra = { googleAndroidClientId?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const GOOGLE_ANDROID_CLIENT_ID = (extra.googleAndroidClientId ?? "").trim();
export const GOOGLE_IOS_CLIENT_ID = "";
export const GOOGLE_WEB_CLIENT_ID = "";

/**
 * Google 的 Android 客户端只认一种回跳地址:
 *   com.googleusercontent.apps.<id>:/oauthredirect
 * 也就是「客户端 id 反写 + /oauthredirect」。
 *
 * expo-auth-session 在独立包里默认用的是 `${包名}:/oauthredirect`(cn.pcmuz.esponal),
 * Google 那边会直接报 redirect_uri_mismatch,表现是授权页报错或授权完回不到 App。
 * 所以这里显式算好传给它。app.config.js 会把同一个 scheme 写进 AndroidManifest。
 */
export const GOOGLE_ANDROID_REDIRECT_URI = GOOGLE_ANDROID_CLIENT_ID
  ? `${GOOGLE_ANDROID_CLIENT_ID.split(".").reverse().join(".")}:/oauthredirect`
  : undefined;

/** 没拿到 client id 时,登录页把 Google 按钮置灰并提示,而不是点了报错 */
export const isGoogleConfigured = Boolean(
  GOOGLE_ANDROID_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
);
