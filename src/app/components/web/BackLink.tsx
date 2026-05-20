import Link from "next/link";

type BackLinkProps = {
  href: string;
  label: string;
};

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      aria-label={`返回${label}`}
      className="-ml-2 mb-2 inline-flex min-h-[44px] items-center gap-1.5 rounded px-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      data-testid="back-link"
      href={href}
    >
      <span aria-hidden="true" className="text-base leading-none">←</span>
      <span>{label}</span>
    </Link>
  );
}
