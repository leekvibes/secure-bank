import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardSidebar user={session.user} />
      {/* Offset for sidebar on desktop, top bar on mobile */}
      <div className="lg:pl-60">
        <main className="min-h-screen pt-14 lg:pt-0">
          <div className="max-w-[1200px] mx-auto px-5 py-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
