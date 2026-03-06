import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export const metadata: Metadata = {
  title: {
    default: "Dashboard | Secure Link",
    template: "%s | Secure Link",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar user={session.user} />
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
