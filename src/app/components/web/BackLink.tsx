"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type BackLinkProps = {
  href: string;
  label: string;
  /**
   * When true, clicking navigates to the previous page in browser history
   * (router.back()) instead of the fixed `href`. The `href` is kept as a
   * graceful fallback for no-JS / direct-load cases.
   */
  useHistoryBack?: boolean;
};

export function BackLink({ href, label, useHistoryBack = false }: BackLinkProps) {
  const router = useRouter();

  const className =
    "-ml-2 mb-2 inline-flex min-h-[44px] items-center gap-1.5 rounded px-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";

  const content = (
    <>
      <span aria-hidden="true" className="text-base leading-none">←</span>
      <span>{label}</span>
    </>
  );

  if (useHistoryBack) {
    return (
      <button
        aria-label={`返回${label}`}
        className={className}
        data-testid="back-link"
        onClick={(event) => {
          // If there is meaningful history, go back; otherwise fall to href.
          if (typeof window !== "undefined" && window.history.length > 1) {
            event.preventDefault();
            router.back();
          } else {
            router.push(href);
          }
        }}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <Link aria-label={`返回${label}`} className={className} data-testid="back-link" href={href}>
      {content}
    </Link>
  );
}
