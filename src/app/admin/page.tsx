import { fetchAdminDashboardData } from "@/services/admin-dashboard";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
