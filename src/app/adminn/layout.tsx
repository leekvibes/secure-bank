import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AdminnnSidebar } from "@/components/adminn-sidebar";

export const metadata = { title: "Mission Control" };

export default async function AdminnnLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <AdminnnSidebar user={session.user} />
      <div className="lg:pl-64">
        <main className="min-h-screen">
          <div className="max-w-[1400px] mx-auto px-5 py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
