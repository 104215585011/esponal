// Timestamp: 2026-06-04 15:02
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { DissectorClient } from "@/app/dissect/DissectorClient";

export default function DissectPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <BackLink href="/learn/foundation" label="7 天总览" />
      </div>
      <DissectorClient />
    </main>
  );
}
