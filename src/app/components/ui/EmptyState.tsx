"use client";

type EmptyStateKind = "empty" | "error" | "loading-failed";

type EmptyStateProps = {
  kind: EmptyStateKind;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  size?: "sm" | "md" | "lg";
};

const sizeClass = {
  sm: "min-h-[160px]",
  md: "min-h-[240px]",
  lg: "min-h-[360px]"
};

const iconClass = {
  empty: "text-gray-300",
  error: "text-orange-300",
  "loading-failed": "text-gray-300"
};

function EmptyIcon({ kind }: { kind: EmptyStateKind }) {
  if (kind === "error") {
    return (
      <svg aria-hidden="true" className="h-full w-full" fill="none" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="34" stroke="currentColor" strokeWidth="3" />
        <path d="M48 25v28" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <circle cx="48" cy="68" fill="currentColor" r="3" />
      </svg>
    );
  }

  if (kind === "loading-failed") {
    return (
      <svg aria-hidden="true" className="h-full w-full" fill="none" viewBox="0 0 96 96">
        <path d="M22 61c14-14 38-14 52 0" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M33 49c9-7 21-7 30 0" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M44 37c3-2 5-2 8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M26 26l44 44" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-full w-full" fill="none" viewBox="0 0 128 96">
      <path
        d="M22 72C34 56 45 49 60 51C75 53 83 66 106 50"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M30 31H98M38 45H78M44 60H68"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <rect height="60" rx="14" stroke="currentColor" strokeWidth="3" width="92" x="18" y="18" />
    </svg>
  );
}

export default function EmptyState({
  action,
  description,
  kind,
  size = "md",
  title
}: EmptyStateProps) {
  return (
    <div className={`flex ${sizeClass[size]} flex-col items-center justify-center px-6 text-center`}>
      <div className={`mb-5 h-20 w-24 ${iconClass[kind]}`}>
        <EmptyIcon kind={kind} />
      </div>
      <p className="text-base font-medium text-gray-700">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-gray-400">{description}</p>
      ) : null}
      {action ? (
        action.href ? (
          <a
            className="mt-4 rounded-card bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            href={action.href}
          >
            {action.label}
          </a>
        ) : (
          <button
            className="mt-4 rounded-card bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
