"use client";

import { useRouter } from "next/navigation";

type GrammarTopicSelectProps = {
  currentSlug?: string;
  topics: Array<{
    slug: string;
    title: string;
  }>;
};

export function GrammarTopicSelect({ currentSlug = "", topics }: GrammarTopicSelectProps) {
  const router = useRouter();

  return (
    <select
      className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-700 shadow-sm"
      defaultValue={currentSlug}
      id="grammar-topic"
      onChange={(event) => {
        if (event.target.value) {
          router.push(`/grammar/${event.target.value}`);
        }
      }}
    >
      {!currentSlug ? (
        <option value="" disabled>
          选择语法话题
        </option>
      ) : null}
      {topics.map((topic) => (
        <option key={topic.slug} value={topic.slug}>
          {topic.title}
        </option>
      ))}
    </select>
  );
}
