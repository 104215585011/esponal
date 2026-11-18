// Timestamp: 2026-11-18 10:58
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";
import { findAdminUser } from "@/lib/admin";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/auth/sign-in?callbackUrl=%2Fadmin");
  if (!(await findAdminUser(userId))) notFound();
  return <AdminDashboard />;
}
