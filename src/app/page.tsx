const stackItems = [
  "Next.js 14 App Router",
  "TypeScript",
  "Tailwind CSS",
  "Prisma + PostgreSQL",
  "Redis",
  "NextAuth.js"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fffaf2] text-brand-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">
          INFRA-001 ready
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          西语学习平台
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
          面向中文母语者的西班牙语学习 App 脚手架已启动。这里将承载可理解输入、
          SRS 复习、语法对比讲解和后续 AI 互动练习。
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stackItems.map((item) => (
            <div
              className="rounded-lg border border-[#eadbc7] bg-white px-4 py-3 text-sm font-medium shadow-sm"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
