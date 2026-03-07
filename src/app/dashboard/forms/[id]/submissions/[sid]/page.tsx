import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="max-w-xl space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
            <Link href={`/dashboard/forms/${params.id}`}>
              <ArrowLeft className="w-4 h-4" />
              Back to form
            </Link>
          </Button>
          <h1 className="ui-page-title">Submission</h1>
          <p className="text-sm text-muted-foreground mt-1">{form.title}</p>
        </div>
        <div className="flex items-center gap-2 mt-8">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/forms/${params.id}/submissions/${params.sid}/export?format=json`} download>
              <Download className="w-3.5 h-3.5" />
              JSON
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/forms/${params.id}/submissions/${params.sid}/export?format=text`} download>
              <Download className="w-3.5 h-3.5" />
              TXT
            </a>
          </Button>
        </div>
      </div>

      {(submission.formLink.clientName || submission.formLink.clientEmail || submission.formLink.clientPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="ui-section-title">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {submission.formLink.clientName && (
              <p className="text-sm"><span className="text-muted-foreground">Name:</span> {submission.formLink.clientName}</p>
            )}
            {submission.formLink.clientEmail && (
              <p className="text-sm"><span className="text-muted-foreground">Email:</span> {submission.formLink.clientEmail}</p>
            )}
            {submission.formLink.clientPhone && (
              <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {submission.formLink.clientPhone}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Submitted {formatDate(submission.createdAt)}</span>
        {submission.viewedAt && (
          <span className="flex items-center gap-1 text-purple-600">
            <Eye className="w-3 h-3" />Viewed {formatDate(submission.viewedAt)}
          </span>
        )}
        <span>Deletes {formatDate(submission.deleteAt)}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="ui-section-title">Submitted data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
                <div key={v.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{v.fieldLabel}</p>
                    {v.isEncrypted && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        <Lock className="w-2.5 h-2.5" />Encrypted
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
                            <img src={raw} alt="Signature" className="max-h-24 border border-border/40 rounded bg-card p-2" />
                          );
                        } catch {
                          return <p className="text-sm text-foreground font-mono">[signature]</p>;
                        }
                      })()
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.value} alt="Signature" className="max-h-24 border border-border/40 rounded bg-card p-2" />
                    )
                  ) : (
                    <p className={`text-sm font-mono ${isSensitive ? "text-muted-foreground" : "text-foreground"} bg-surface-2 px-3 py-2 rounded-lg border border-border/30`}>
                      {displayVal}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
