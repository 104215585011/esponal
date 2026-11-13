// Timestamp: 2026-11-14 03:25
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

/**
 * 应用内更新:下载 APK → 拉起系统安装器。
 *
 * 这是 Android 侧载 App 能做到的极限(「在软件基础上直接更新」):
 * - 用户不用离开 App 去浏览器
 * - 但**最后一步必须用户点确认安装** —— Android 不允许应用静默安装 APK,
 *   这是系统安全策略,不是实现问题。
 *
 * 依赖:
 * - android.permissions 含 REQUEST_INSTALL_PACKAGES(app.json 已配)
 * - 首次更新时系统会弹「允许安装未知应用」,用户授权后后续更新不再打扰
 */

const APK_DIR = `${FileSystem.cacheDirectory ?? ""}updates/`;
const APK_NAME = "esponal-update.apk";

export type DownloadProgress = {
  /** 0~1,未知总量时为 null */
  ratio: number | null;
  /** 已下载字节 */
  written: number;
  /** 总字节,未知为 0 */
  total: number;
};

function ensureDir() {
  // cacheDirectory 可能为 null(极少数平台)
  return FileSystem.getInfoAsync(APK_DIR).then((info) => {
    if (!info.exists) {
      return FileSystem.makeDirectoryAsync(APK_DIR, { intermediates: true });
    }
    return undefined;
  });
}

/**
 * 下载 APK 并唤起安装器。
 * @returns 是否成功把安装器拉起
 */
export async function downloadAndInstall(
  url: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ ok: boolean; message?: string }> {
  if (Platform.OS !== "android") {
    return { ok: false, message: "仅 Android 支持应用内安装" };
  }

  try {
    await ensureDir();

    const target = `${APK_DIR}${APK_NAME}`;

    // 清掉上次残留(避免装到旧包)
    await FileSystem.deleteAsync(target, { idempotent: true });

    const download = FileSystem.createDownloadResumable(
      url,
      target,
      {},
      (data) => {
        const total = data.totalBytesExpectedToWrite ?? 0;
        const written = data.totalBytesWritten ?? 0;
        onProgress?.({
          ratio: total > 0 ? Math.min(written / total, 1) : null,
          written,
          total
        });
      }
    );

    const result = await download.downloadAsync();

    if (!result?.uri) {
      return { ok: false, message: "下载失败,请检查网络" };
    }

    // file:// → content://(Android 7+ 必须走 FileProvider)
    const contentUri = await FileSystem.getContentUriAsync(result.uri);

    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      // FLAG_GRANT_READ_URI_PERMISSION
      flags: 1,
      type: "application/vnd.android.package-archive"
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: message.includes("EUNSPECIFIED")
        ? "无法拉起安装器,请检查「安装未知应用」权限"
        : message
    };
  }
}

/** 清理下载的安装包(安装完成后可调用,省空间) */
export async function cleanupDownloadedApk() {
  try {
    await FileSystem.deleteAsync(`${APK_DIR}${APK_NAME}`, { idempotent: true });
  } catch {
    // ignore
  }
}
