import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import ReviewClient from "@/app/vocab/review/ReviewClient";
import { getAuthOptions } from "@/lib/auth";

export default async function VocabReviewPage() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <BackLink href="/vocab" label="语料库" />

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SRS 复习</h1>
          <p className="mt-2 text-sm text-gray-500">
            先看词，再翻面确认释义和例句，然后给出熟悉度评分。
          </p>
        </header>
        <ReviewClient />
      </section>
    </main>
  );
}
