import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Eye, Download, ClipboardList, User, Mail, Phone, Calendar, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decrypt } from "@/lib/crypto";
import { formatDate } from "@/lib/utils";

export default async function FormSubmissionPage({
  params,
}: {
  params: { id: string; sid: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
    select: { title: true },
  });
  if (!form) notFound();

  const submission = await db.formSubmission.findFirst({
    where: { id: params.sid, formId: params.id },
    include: {
      formLink: { select: { clientName: true, clientEmail: true, clientPhone: true } },
      values: {
        include: { field: { select: { fieldType: true, maskInput: true } } },
        orderBy: { field: { order: "asc" } },
      },
    },
  });
  if (!submission) notFound();

  if (!submission.viewedAt) {
    await db.formSubmission.update({ where: { id: submission.id }, data: { viewedAt: new Date() } });
  }

  const SENSITIVE_FIELD_TYPES = ["ssn", "routing", "bank_account"];

  function displayValue(value: string, fieldType: string, maskInput: boolean): string {
    if (["ssn", "bank_account"].includes(fieldType)) {
      const digits = value.replace(/\D/g, "");
      return "****" + digits.slice(-4);
    }
    if (fieldType === "routing") {
      return value;
    }
    return value;
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">

      <Link
        href={`/dashboard/forms/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to form
      </Link>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500/5 via-primary/5 to-transparent px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/20">
              <ClipboardList className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-foreground leading-tight">Submission</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-600 ring-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Received
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{form.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <a href={`/api/forms/${params.id}/submissions/${params.sid}/export?format=json`} download>
                  <Download className="w-3.5 h-3.5" />
                  JSON
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="rounded-xl">
                <a href={`/api/forms/${params.id}/submissions/${params.sid}/export?format=text`} download>
                  <Download className="w-3.5 h-3.5" />
                  TXT
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-border">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-2 text-muted-foreground ring-1 ring-border/40">
            <Calendar className="w-3 h-3" />
            Submitted {formatDate(submission.createdAt)}
          </span>
          {submission.viewedAt && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20">
              <Eye className="w-3 h-3" />
              Viewed {formatDate(submission.viewedAt)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
            <Trash2 className="w-3 h-3" />
            Deletes {formatDate(submission.deleteAt)}
          </span>
        </div>
      </div>

      {(submission.formLink.clientName || submission.formLink.clientEmail || submission.formLink.clientPhone) && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/5 via-primary/5 to-transparent px-6 py-4 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Client
            </h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {submission.formLink.clientName && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Name</p>
                  <p className="text-sm font-medium text-foreground">{submission.formLink.clientName}</p>
                </div>
              </div>
            )}
            {submission.formLink.clientEmail && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-violet-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-sm font-medium text-foreground">{submission.formLink.clientEmail}</p>
                </div>
              </div>
            )}
            {submission.formLink.clientPhone && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-medium text-foreground">{submission.formLink.clientPhone}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent px-6 py-4 border-b border-border">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Submitted data
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="space-y-5">
            {submission.values.map((v) => {
              const isSensitive = SENSITIVE_FIELD_TYPES.includes(v.field.fieldType);
              let displayVal: string;
              try {
                const raw = v.isEncrypted ? decrypt(v.value) : v.value;
                displayVal = displayValue(raw, v.field.fieldType, v.field.maskInput);
              } catch {
                displayVal = "[decryption error]";
              }

              return (
                <div key={v.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{v.fieldLabel}</p>
                    {v.isEncrypted && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ring-1 ring-primary/20">
                        <Lock className="w-2.5 h-2.5" />
                        Encrypted
                      </span>
                    )}
                  </div>
                  {v.field.fieldType === "signature" ? (
                    v.isEncrypted ? (
                      (() => {
                        try {
                          const raw = decrypt(v.value);
                          return (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={raw} alt="Signature" className="max-h-24 border border-border/40 rounded-xl bg-surface-2 p-3 ring-1 ring-border/20" />
                          );
                        } catch {
                          return <p className="text-sm text-foreground font-mono">[signature]</p>;
                        }
                      })()
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.value} alt="Signature" className="max-h-24 border border-border/40 rounded-xl bg-surface-2 p-3 ring-1 ring-border/20" />
                    )
                  ) : (
                    <p className={`text-sm font-mono ${isSensitive ? "text-muted-foreground" : "text-foreground"} bg-surface-2 px-4 py-2.5 rounded-xl border border-border/30 ring-1 ring-border/10`}>
                      {displayVal}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
