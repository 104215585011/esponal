import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { DissectorClient } from "@/app/dissect/DissectorClient";

export default function DissectPage() {
  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <BackLink href="/learn/foundation" label="7 天总览" />
      </div>
      <DissectorClient />
    </main>
  );
}
