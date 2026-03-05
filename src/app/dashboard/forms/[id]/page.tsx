import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Lock, Calendar, CheckCircle2, Clock, Eye, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, isExpired } from "@/lib/utils";
import { FormLinkGenerator } from "@/components/form-link-generator";

export default async function FormDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

  // Mark expired form links
  await db.formLink.updateMany({
    where: {
      form: { agentId: session.user.id },
      status: { notIn: ["SUBMITTED", "EXPIRED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const form = await db.form.findFirst({
    where: { id: params.id, agentId: session.user.id },
    include: {
      fields: { orderBy: { order: "asc" } },
      links: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { submission: { select: { id: true, viewedAt: true, createdAt: true } } },
      },
    },
  });

  if (!form) notFound();

  const FIELD_TYPE_LABELS: Record<string, string> = {
    text: "Text", email: "Email", phone: "Phone", address: "Address",
    date: "Date", dropdown: "Dropdown", ssn: "SSN", routing: "Routing #",
    bank_account: "Bank Account", signature: "Signature",
  };

  const submittedLinks = form.links.filter((l) => l.status === "SUBMITTED");
  const activeLinks = form.links.filter((l) => l.status === "CREATED" || l.status === "OPENED");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href="/dashboard/forms">
            <ArrowLeft className="w-4 h-4" />
            All forms
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-slate-500 mt-1">{form.description}</p>
            )}
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${
            form.status === "ACTIVE"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200/60"
              : "bg-slate-100 text-slate-500 ring-slate-200/60"
          }`}>
            {form.status === "ACTIVE" ? "Active" : "Archived"}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          <span>{form.fields.length} fields</span>
          <span>·</span>
          <span>{submittedLinks.length} submissions</span>
          <span>·</span>
          <span>Retention: {form.retentionDays === -1 ? "Manual" : `${form.retentionDays} days`}</span>
        </div>
      </div>

      {/* Field summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form fields</CardTitle>
          <CardDescription>Fields rendered on the client form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {form.fields.map((field) => (
              <div key={field.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs font-medium text-slate-500 w-24 shrink-0">
                  {FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}
                </span>
                <span className="text-sm text-slate-800 flex-1">{field.label}</span>
                <div className="flex gap-1.5 shrink-0">
                  {field.required && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Required</span>
                  )}
                  {field.encrypted && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />Enc
                    </span>
                  )}
                  {field.confirmField && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Confirm</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate link */}
      <FormLinkGenerator formId={form.id} formTitle={form.title} />

      {/* Active links */}
      {activeLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active links</CardTitle>
            <CardDescription>Pending or opened links that have not been submitted yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeLinks.map((link) => (
                <LinkRow key={link.id} link={link} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submissions</CardTitle>
          <CardDescription>
            {submittedLinks.length === 0
              ? "No submissions yet. Share a link to start collecting data."
              : `${submittedLinks.length} submission${submittedLinks.length !== 1 ? "s" : ""} received.`}
          </CardDescription>
        </CardHeader>
        {submittedLinks.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {submittedLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {link.clientName ?? "Anonymous"}
                      </span>
                      {link.submission?.viewedAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                          <Eye className="w-3 h-3" />Viewed
                        </span>
                      )}
                    </div>
                    {link.submission?.createdAt && (
                      <span className="text-xs text-slate-400 ml-6">
                        Submitted {formatDate(link.submission.createdAt)}
                      </span>
                    )}
                  </div>
                  {link.submission && (
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link href={`/dashboard/forms/${form.id}/submissions/${link.submission.id}`}>
                        View
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function LinkRow({
  link,
}: {
  link: {
    id: string;
    token: string;
    clientName: string | null;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  };
}) {
  const expired = isExpired(link.expiresAt);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-700 truncate block">
          {link.clientName ?? "Unnamed"} — <code className="text-xs text-slate-400">/f/{link.token.slice(0, 10)}…</code>
        </span>
        <span className="text-xs text-slate-400">
          {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
        </span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ring-1 ${
        expired
          ? "bg-slate-100 text-slate-500 ring-slate-200/60"
          : link.status === "OPENED"
          ? "bg-amber-50 text-amber-600 ring-amber-200/60"
          : "bg-blue-50 text-blue-600 ring-blue-200/60"
      }`}>
        {expired ? "Expired" : link.status.charAt(0) + link.status.slice(1).toLowerCase()}
      </span>
    </div>
  );
}
