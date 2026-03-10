import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AdminSidebar } from "@/components/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar user={session.user} />
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
