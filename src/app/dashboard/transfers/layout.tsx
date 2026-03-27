import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export default async function TransfersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  const planConfig = getPlan(user?.plan ?? "FREE");
  if (!planConfig.canUseTransfers) {
    redirect("/dashboard/settings?upgrade=transfers");
  }

  return <>{children}</>;
}
