import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Eye } from "lucide-react";
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

  // Mark as viewed
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
      return value; // Show full routing (not sensitive to display)
    }
    return value;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href={`/dashboard/forms/${params.id}`}>
            <ArrowLeft className="w-4 h-4" />
            Back to form
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Submission</h1>
        <p className="text-sm text-slate-500 mt-1">{form.title}</p>
      </div>

      {/* Client info */}
      {(submission.formLink.clientName || submission.formLink.clientEmail || submission.formLink.clientPhone) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {submission.formLink.clientName && (
              <p className="text-sm"><span className="text-slate-500">Name:</span> {submission.formLink.clientName}</p>
            )}
            {submission.formLink.clientEmail && (
              <p className="text-sm"><span className="text-slate-500">Email:</span> {submission.formLink.clientEmail}</p>
            )}
            {submission.formLink.clientPhone && (
              <p className="text-sm"><span className="text-slate-500">Phone:</span> {submission.formLink.clientPhone}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meta */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>Submitted {formatDate(submission.createdAt)}</span>
        {submission.viewedAt && (
          <span className="flex items-center gap-1 text-purple-600">
            <Eye className="w-3 h-3" />Viewed {formatDate(submission.viewedAt)}
          </span>
        )}
        <span>Deletes {formatDate(submission.deleteAt)}</span>
      </div>

      {/* Field values */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submitted data</CardTitle>
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
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{v.fieldLabel}</p>
                    {v.isEncrypted && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
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
                            <img src={raw} alt="Signature" className="max-h-24 border border-slate-200 rounded bg-white p-2" />
                          );
                        } catch {
                          return <p className="text-sm text-slate-900 font-mono">[signature]</p>;
                        }
                      })()
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.value} alt="Signature" className="max-h-24 border border-slate-200 rounded bg-white p-2" />
                    )
                  ) : (
                    <p className={`text-sm font-mono ${isSensitive ? "text-slate-600" : "text-slate-900"} bg-slate-50 px-3 py-2 rounded-lg border border-slate-100`}>
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
