// Timestamp: 2026-06-11 11:05
"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getParentTabForPath } from "./routes";

type UseShellBackOptions = {
  closeSheet?: () => void;
  sheetOpen?: boolean;
};

export function useShellBack(options: UseShellBackOptions = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { closeSheet, sheetOpen = false } = options;

  return useCallback(() => {
    if (sheetOpen && closeSheet) {
      closeSheet();
      return;
    }

    const fallbackTab = getParentTabForPath(pathname);
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(fallbackTab);
  }, [closeSheet, pathname, router, sheetOpen]);
}
