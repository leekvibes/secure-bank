import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { isExpired } from "@/lib/utils";
import { writeAuditLog } from "@/lib/audit";
import { headers } from "next/headers";
import { SecureFormClient } from "@/components/secure-form-client";
import { ensureLegacyLogoAsset, toAssetRenderEntry } from "@/lib/asset-library";

interface Props {
  params: { token: string };
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Submission",
};

export default async function SecurePage({ params }: Props) {
  const link = await db.secureLink.findUnique({
    where: { token: params.token },
    include: {
      agent: {
        select: {
          id: true,
          displayName: true,
          agencyName: true,
          company: true,
          industry: true,
          logoUrl: true,
          photoUrl: true,
          destinationLabel: true,
          licenseNumber: true,
          verificationStatus: true,
          phone: true,
        },
      },
      assets: {
        orderBy: { order: "asc" },
        include: { asset: true },
      },
    },
  });

  if (!link) notFound();

  if (isExpired(link.expiresAt) || link.status === "EXPIRED") {
    return <ExpiredPage />;
  }

  const [existingSubmission, existingUpload] = await Promise.all([
    db.submission.findUnique({ where: { linkId: link.id } }),
    db.idUpload.findUnique({ where: { linkId: link.id } }),
  ]);

  if (existingSubmission || existingUpload) {
    return <AlreadySubmittedPage linkType={link.linkType} />;
  }

  if (link.status === "CREATED") {
    await db.secureLink.update({ where: { id: link.id }, data: { status: "OPENED" } });
    const headersList = headers();
    await writeAuditLog({
      event: "LINK_OPENED",
      agentId: link.agentId,
      linkId: link.id,
      metadata: { linkType: link.linkType },
      request: new Request("https://placeholder", {
        headers: {
          "x-forwarded-for": headersList.get("x-forwarded-for") ?? "",
          "user-agent": headersList.get("user-agent") ?? "",
        },
      }),
    });
  }

  await ensureLegacyLogoAsset(link.agent.id);
  const selectedAssets = link.assets.length > 0
    ? link.assets.map((a) => a.asset)
    : await db.agentAsset.findMany({
        where: { userId: link.agent.id, type: "LOGO" },
        orderBy: { createdAt: "desc" },
      });
  const renderedAssets = (
    await Promise.all(selectedAssets.map(toAssetRenderEntry))
  ).filter((a) => a.url && a.mimeType.startsWith("image/"));
  const logoUrls = renderedAssets.map((a) => a.url as string);
  let linkOptions: Record<string, unknown> = {};
  if (link.optionsJson) {
    try {
      linkOptions = JSON.parse(link.optionsJson) as Record<string, unknown>;
    } catch {
      linkOptions = {};
    }
  }

  return (
    <SecureFormClient
      token={params.token}
      linkType={link.linkType}
      linkOptions={linkOptions}
      agent={{
        displayName: link.agent.displayName,
        agencyName: link.agent.agencyName,
        company: link.agent.company,
        industry: link.agent.industry,
        destinationLabel: link.agent.destinationLabel,
        licenseNumber: link.agent.licenseNumber,
        verificationStatus: link.agent.verificationStatus,
        phone: link.agent.phone,
        photoUrl: link.agent.photoUrl,
      }}
      logoUrls={logoUrls}
      clientName={link.clientName}
      expiresAt={link.expiresAt.toISOString()}
    />
  );
}

function ExpiredPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,93%)] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-8">Secure Link</p>
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-amber-200">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">This Link Has Expired</h1>
        <p className="text-muted-foreground text-sm">For your security, this link is no longer active. Please contact your agent to request a new secure link.</p>
      </div>
    </main>
  );
}

const LINK_TYPE_LABELS: Record<string, string> = {
  BANKING_INFO: "banking information",
  SSN_ONLY: "Social Security Number",
  FULL_INTAKE: "personal information",
  ID_UPLOAD: "ID document",
};

function AlreadySubmittedPage({ linkType }: { linkType: string }) {
  const typeLabel = LINK_TYPE_LABELS[linkType] ?? "information";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[hsl(210,25%,97%)] to-[hsl(210,20%,93%)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-4 animate-fade-in">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase text-center">Secure Link</p>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-amber-200">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Unavailable</h1>
          <p className="text-slate-600 font-medium mb-1">This link has already been used.</p>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            This {typeLabel} submission link is no longer active. It may have already been used or expired.
            Contact your agent to request a new secure link.
          </p>

          <a
            href="mailto:support@mysecurelink.co"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors"
          >
            support@mysecurelink.co
          </a>
        </div>

        <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Concerned about fraud?</p>
              <p className="text-sm text-red-600 leading-relaxed">
                If you believe someone may be trying to use this link to scam you, or if you did not authorize any submission, contact us immediately at{" "}
                <a href="mailto:support@mysecurelink.co" className="font-bold underline hover:no-underline">support@mysecurelink.co</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
