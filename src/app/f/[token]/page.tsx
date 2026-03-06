import type { Metadata } from "next";
import { db } from "@/lib/db";
import { isExpired } from "@/lib/utils";
import { notFound } from "next/navigation";
import { DynamicFormClient } from "@/components/dynamic-form-client";
import type { FormFieldType } from "@/lib/schemas";
import { ensureLegacyLogoAsset, toAssetRenderEntry } from "@/lib/asset-library";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Form Submission",
};

interface Props {
  params: { token: string };
}

export default async function FormPage({ params }: Props) {
  const link = await db.formLink.findUnique({
    where: { token: params.token },
    include: {
      form: {
        include: {
          fields: { orderBy: { order: "asc" } },
          agent: {
            select: {
              id: true,
              displayName: true,
              agencyName: true,
              company: true,
              industry: true,
              logoUrl: true,
              destinationLabel: true,
              licenseNumber: true,
              verificationStatus: true,
              phone: true,
            },
          },
        },
      },
      submission: { select: { id: true } },
      assets: { orderBy: { order: "asc" }, include: { asset: true } },
    },
  });

  if (!link) notFound();

  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return <StatusPage type="expired" />;
  }

  if (link.submission || link.status === "SUBMITTED") {
    return <StatusPage type="submitted" />;
  }

  // Mark opened
  if (link.status === "CREATED") {
    await db.formLink.update({ where: { id: link.id }, data: { status: "OPENED" } });
  }

  const fields = link.form.fields.map((f) => ({
    id: f.id,
    label: f.label,
    fieldType: f.fieldType as FormFieldType,
    placeholder: f.placeholder,
    helpText: f.helpText,
    required: f.required,
    maskInput: f.maskInput,
    confirmField: f.confirmField,
    dropdownOptions: f.dropdownOptions ? JSON.parse(f.dropdownOptions) as string[] : null,
  }));

  // Resolve logo URLs from link-specific assets, or fall back to agent default
  await ensureLegacyLogoAsset(link.form.agent.id);
  const selectedAssets = link.assets.length > 0
    ? link.assets.map((a) => a.asset)
    : await db.agentAsset.findMany({
        where: { userId: link.form.agent.id, type: "LOGO" },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
  const renderedAssets = (
    await Promise.all(selectedAssets.map(toAssetRenderEntry))
  ).filter((a) => a.url && a.mimeType.startsWith("image/"));
  const logoUrls = renderedAssets.map((a) => a.url as string);

  return (
    <DynamicFormClient
      token={params.token}
      form={{ title: link.form.title, description: link.form.description }}
      fields={fields}
      agent={link.form.agent}
      logoUrls={logoUrls}
      link={{ clientName: link.clientName, expiresAt: link.expiresAt.toISOString() }}
    />
  );
}

function StatusPage({ type }: { type: "expired" | "submitted" }) {
  if (type === "expired") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">This link has expired</h1>
          <p className="text-slate-500 text-sm">Contact your agent to request a new secure form link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Already submitted</h1>
        <p className="text-slate-500 text-sm">Your information has already been received. You&apos;re all done.</p>
      </div>
    </main>
  );
}
