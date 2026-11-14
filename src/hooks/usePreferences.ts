// Timestamp: 2026-11-14 20:29
import { useEffect, useState } from "react";

import {
  DEFAULT_PREFERENCES,
  getPreferences,
  loadPreferences,
  subscribePreferences,
  type Preferences
} from "@/lib/preferences";

/**
 * 读取本地偏好。首帧用内存里的值(未加载完就是默认值),加载完成后自动刷新,
 * 设置页改动通过 subscribe 立刻同步到所有在用的页面。
 */
export function usePreferences(): Preferences {
  // 注意:必须调用 getPreferences(),传函数本身会变成把函数当 Preferences 用
  const [prefs, setPrefs] = useState<Preferences>(() => getPreferences() ?? DEFAULT_PREFERENCES);

  useEffect(() => {
    let mounted = true;

    void loadPreferences().then((value) => {
      if (mounted) setPrefs(value);
    });

    const unsubscribe = subscribePreferences((value) => {
      if (mounted) setPrefs(value);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return prefs;
}
