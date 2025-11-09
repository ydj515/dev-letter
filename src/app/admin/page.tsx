import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAdminDashboardData } from "@/services/admin-dashboard";
import AdminDashboardClient from "./AdminDashboardClient";
import { encodeAdminCredentials } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureAdminSession();
  const data = await fetchAdminDashboardData({ limit: 10 });
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-emerald-300">Operations</p>
          <h1 className="text-3xl font-semibold">Newsletter Control Room</h1>
          <p className="text-gray-400">
            미리보기 · 승인 · 재발송 · 즉시 생성 · 관측을 한 곳에서 처리합니다.
          </p>
        </header>
        <AdminDashboardClient data={data} />
      </div>
    </main>
  );
}

async function ensureAdminSession() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("ADMIN_USERNAME/ADMIN_PASSWORD are not configured");
  }

  const store = await cookies();
  const token = store.get("admin-auth")?.value;
  const expected = encodeAdminCredentials(username, password);

  if (token !== expected) {
    redirect(`/admin/login?redirect=${encodeURIComponent("/admin")}`);
  }
}
