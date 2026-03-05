import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav user={session.user} />
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
