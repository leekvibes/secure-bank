import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getPlan } from "@/lib/plans";

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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, plan: true },
  });

  if (user && !user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const planConfig = getPlan(user?.plan ?? "FREE");

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        user={session.user}
        canUseTransfers={planConfig.canUseTransfers}
      />
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
