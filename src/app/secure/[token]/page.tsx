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

  // Check for existing submission / upload
  const [existingSubmission, existingUpload] = await Promise.all([
    db.submission.findUnique({ where: { linkId: link.id } }),
    db.idUpload.findUnique({ where: { linkId: link.id } }),
  ]);

  if (existingSubmission || existingUpload) {
    return <AlreadySubmittedPage />;
  }

  // Mark as OPENED if first visit
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

  // Resolve logo URLs: link-specific assets → fallback to agent logoUrl
  await ensureLegacyLogoAsset(link.agent.id);
  const selectedAssets = link.assets.length > 0
    ? link.assets.map((a) => a.asset)
    : await db.agentAsset.findMany({
        where: { userId: link.agent.id, type: "LOGO" },
        orderBy: { createdAt: "desc" },
        take: 1,
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
      }}
      logoUrls={logoUrls}
      clientName={link.clientName}
      expiresAt={link.expiresAt.toISOString()}
    />
  );
}

function ExpiredPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">This link has expired</h1>
        <p className="text-slate-500 text-sm">Contact your agent to request a new secure link.</p>
      </div>
    </main>
  );
}

function AlreadySubmittedPage() {
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
