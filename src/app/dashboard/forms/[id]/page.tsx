import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, CheckCircle2, Clock, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, isExpired } from "@/lib/utils";
import { FormFieldEditor } from "@/components/form-field-editor";
import { FormLinkGenerator } from "@/components/form-link-generator";

export const metadata: Metadata = {
  title: "Form Details",
};

export default async function FormDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth");

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
    <div className="space-y-8 animate-fade-in">

      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-5 text-muted-foreground">
          <Link href="/dashboard/links">
            <ArrowLeft className="w-4 h-4" />
            Secure Links
          </Link>
        </Button>

        <div className="flex items-start gap-3 mb-1">
          <h1 className="ui-page-title">{form.title}</h1>
          <span className={`mt-1 shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
            form.status === "ACTIVE"
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-surface-2 text-muted-foreground"
          }`}>
            {form.status === "ACTIVE" ? "Active" : "Archived"}
          </span>
        </div>
        {form.description && (
          <p className="text-sm text-muted-foreground mb-2">{form.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{form.fields.length} field{form.fields.length !== 1 ? "s" : ""}</span>
          <span className="text-border">·</span>
          <span>{submittedLinks.length} submission{submittedLinks.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

        <div className="space-y-6">

          <FormFieldEditor
            formId={form.id}
            initialFields={form.fields.map((f) => ({
              id: f.id,
              label: f.label,
              fieldType: f.fieldType,
              placeholder: f.placeholder,
              helpText: f.helpText,
              required: f.required,
              encrypted: f.encrypted,
              maskInput: f.maskInput,
              confirmField: f.confirmField,
              dropdownOptions: f.dropdownOptions,
            }))}
          />

          <div className="ui-table-wrap">
            <div className="px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold text-foreground">Form fields</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fields rendered on the client submission form.</p>
            </div>
            <div className="hidden sm:grid sm:grid-cols-[90px_1fr_auto] items-center gap-4 px-5 py-2.5 border-b border-border/30 ui-table-header">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</span>
            </div>
            {form.fields.map((field, i) => (
              <div
                key={field.id}
                className={`flex sm:grid sm:grid-cols-[90px_1fr_auto] items-center gap-3 sm:gap-4 px-5 py-3 ${
                  i < form.fields.length - 1 ? "border-b border-border/20" : ""
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground bg-surface-2 border border-border/40 rounded px-2 py-0.5 inline-block truncate shrink-0">
                  {FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}
                </span>
                <span className="text-sm text-foreground flex-1">{field.label}</span>
                <div className="flex gap-1.5 shrink-0">
                  {field.required && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground">Req</span>
                  )}
                  {field.encrypted && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />Enc
                    </span>
                  )}
                  {field.confirmField && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Confirm</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="ui-table-wrap">
            <div className="px-5 py-4 border-b border-border/40">
              <h2 className="text-sm font-semibold text-foreground">Submissions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {submittedLinks.length === 0
                  ? "No submissions yet — share a link to start collecting data."
                  : `${submittedLinks.length} submission${submittedLinks.length !== 1 ? "s" : ""} received.`}
              </p>
            </div>
            {submittedLinks.length > 0 && (
              <>
                <div className="hidden sm:grid sm:grid-cols-[1fr_160px_100px_40px] items-center gap-4 px-5 py-2.5 border-b border-border/30 ui-table-header">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                  <span />
                </div>
                {submittedLinks.map((link, i) => (
                  <div
                    key={link.id}
                    className={`ui-table-row flex sm:grid sm:grid-cols-[1fr_160px_100px_40px] items-center gap-3 sm:gap-4 px-5 py-3.5 ${
                      i < submittedLinks.length - 1 ? "border-b border-border/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {link.clientName ?? "Anonymous"}
                      </span>
                    </div>
                    <div className="hidden sm:block">
                      {link.submission?.createdAt && (
                        <span className="text-xs text-muted-foreground">{formatDate(link.submission.createdAt)}</span>
                      )}
                    </div>
                    <div>
                      {link.submission?.viewedAt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-600">
                          <Eye className="w-3 h-3" />Viewed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-600">
                          New
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end ml-auto sm:ml-0">
                      {link.submission && (
                        <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Link href={`/dashboard/forms/${form.id}/submissions/${link.submission.id}`}>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <FormLinkGenerator
            formId={form.id}
            formTitle={form.title}
          />

          {activeLinks.length > 0 && (
            <div className="ui-table-wrap">
              <div className="px-5 py-4 border-b border-border/40">
                <h2 className="text-sm font-semibold text-foreground">Active links</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Pending or opened, not yet submitted.</p>
              </div>
              {activeLinks.map((link, i) => {
                const expired = isExpired(link.expiresAt);
                return (
                  <div
                    key={link.id}
                    className={`flex items-center gap-3 px-5 py-3.5 ${
                      i < activeLinks.length - 1 ? "border-b border-border/20" : ""
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground truncate block">
                        {link.clientName ?? "Unnamed"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {expired ? "Expired" : "Expires"} {formatDate(link.expiresAt)}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md shrink-0 ${
                      expired
                        ? "bg-surface-2 text-muted-foreground"
                        : link.status === "OPENED"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {expired ? "Expired" : link.status.charAt(0) + link.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
