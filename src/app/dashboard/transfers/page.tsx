import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, FolderUp, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransferActions } from "./transfer-actions";

function fmtBytes(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function TransfersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const now = new Date();

  // Mark expired
  await db.fileTransfer.updateMany({
    where: {
      agentId: session.user.id,
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  const transfers = await db.fileTransfer.findMany({
    where: { agentId: session.user.id },
    include: { files: { select: { id: true, fileName: true, sizeBytes: true } } },
    orderBy: { createdAt: "desc" },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "https://mysecurelink.co";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transfers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Send large files securely — like WeTransfer</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/transfers/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New Transfer
          </Link>
        </Button>
      </div>

      {transfers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border">
          <FolderUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No transfers yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Upload files and share a download link</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/transfers/new">Create your first transfer</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const url = `${appUrl}/t/${t.token}`;
            const expired = t.status === "EXPIRED";
            const downloaded = t.status === "DOWNLOADED" && t.viewOnce;
            const daysLeft = Math.max(0, Math.ceil((t.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-card p-4 flex items-start gap-4 ${expired || downloaded ? "opacity-60" : ""}`}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <FolderUp className="w-4 h-4 text-blue-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {t.title || `Transfer — ${t.files.length} file${t.files.length !== 1 ? "s" : ""}`}
                    </p>
                    <StatusBadge status={t.status} viewOnce={t.viewOnce} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.files.length} file{t.files.length !== 1 ? "s" : ""} · {fmtBytes(t.totalSizeBytes)}
                    {!expired && !downloaded && ` · ${daysLeft}d left`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">{url}</p>
                </div>

                <TransferActions transferId={t.id} url={url} expired={expired || downloaded} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, viewOnce }: { status: string; viewOnce: boolean }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Active{viewOnce ? " · View Once" : ""}
      </span>
    );
  }
  if (status === "DOWNLOADED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Downloaded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      <XCircle className="w-2.5 h-2.5" />
      Expired
    </span>
  );
}
