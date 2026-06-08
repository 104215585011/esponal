// Timestamp: 2026-06-08 20:58
import { UnifiedImportClient } from "./UnifiedImportClient";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="min-h-screen bg-app px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
      <UnifiedImportClient />
    </main>
  );
}
