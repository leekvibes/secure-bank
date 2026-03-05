import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      agencyName: true,
      phone: true,
      licenseNumber: true,
      licensedStates: true,
      agentSlug: true,
      email: true,
    },
  });

  if (!user) redirect("/auth");

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your profile and verification page settings.
        </p>
      </div>
      <SettingsForm user={user} />
    </div>
  );
}
