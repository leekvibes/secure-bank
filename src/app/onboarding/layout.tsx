import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, emailVerified: true },
  });

  if (user?.onboardingCompleted) {
    redirect("/dashboard");
  }

  if (!user?.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(210,30%,97%)] via-[hsl(210,25%,95%)] to-[hsl(210,20%,93%)]">
      {children}
    </div>
  );
}
