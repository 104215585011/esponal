import { SiteHeader } from "@/app/components/web/SiteHeader";
import { DissectorClient } from "@/app/dissect/DissectorClient";

export default function DissectPage() {
  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <DissectorClient />
    </main>
  );
}
