// Timestamp: 2026-06-04 16:15
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { DissectorClient } from "@/app/dissect/DissectorClient";

export default function DissectPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <DissectorClient />
    </main>
  );
}
