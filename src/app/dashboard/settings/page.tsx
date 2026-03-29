import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      agencyName: true,
      company: true,
      phone: true,
      licenseNumber: true,
      licensedStates: true,
      agentSlug: true,
      email: true,
      logoUrl: true,
      photoUrl: true,
      industry: true,
      destinationLabel: true,
      carriersList: true,
      notificationEmail: true,
      verificationStatus: true,
      dataRetentionDays: true,
      trustMessage: true,
      defaultExpirationHours: true,
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) redirect("/auth");

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="ui-page-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile, branding, and security settings.
        </p>
      </div>
      <SettingsForm user={{ ...user, stripeSubscriptionId: user.stripeSubscriptionId ?? null }} />
    </div>
  );
}
