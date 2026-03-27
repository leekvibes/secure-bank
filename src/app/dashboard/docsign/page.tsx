import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, FileSignature, CheckCircle2, Clock, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default async function DocSignPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth");

  const requests = await db.docSignRequest.findMany({
    where: { agentId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statusIcon = (status: string) => {
    if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === "SENT" || status === "OPENED") return <Send className="w-4 h-4 text-blue-500" />;
    if (status === "EXPIRED") return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      SENT: "Awaiting signature",
      OPENED: "Opened by client",
      COMPLETED: "Signed",
      EXPIRED: "Expired",
    };
    return labels[status] ?? status;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Signing</h1>
          <p className="text-muted-foreground text-sm mt-1">Send documents for electronic signature</p>
        </div>
        <Link href="/dashboard/docsign/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New signing request
          </Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <FileSignature className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">No signing requests yet</h2>
          <p className="text-muted-foreground text-sm mb-6">Upload a document, place signature fields, and send to your client.</p>
          <Link href="/dashboard/docsign/new">
            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Create first request
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((doc) => (
            <Link key={doc.id} href={`/dashboard/docsign/${doc.id}`}>
              <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSignature className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.title ?? "Untitled document"}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {doc.clientName ?? doc.clientEmail ?? "No client assigned"} · {doc.originalName ?? "document"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusIcon(doc.status)}
                  <span className="text-sm text-muted-foreground hidden sm:block">{statusLabel(doc.status)}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                  {formatDistanceToNow(doc.createdAt, { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
