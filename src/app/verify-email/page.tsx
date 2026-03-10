import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { VerifyEmailClient } from "./verify-email-client";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true, email: true },
  });

  // Already verified — send them to onboarding
  if (user?.emailVerified) redirect("/onboarding/profile");

  return <VerifyEmailClient email={user?.email ?? ""} />;
}
