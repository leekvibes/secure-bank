export type LegacySubmissionRow = {
  id: string;
  createdAt: Date;
  revealedAt: Date | null;
  link: {
    id: string;
    clientName: string | null;
    linkType: string;
  };
};

export type FormSubmissionRow = {
  id: string;
  createdAt: Date;
  viewedAt: Date | null;
  formId: string;
  form: { title: string };
  formLink: { clientName: string | null };
};

export type IdUploadRow = {
  id: string;
  createdAt: Date;
  viewedAt: Date | null;
  link: {
    id: string;
    clientName: string | null;
  };
};

export type SubmissionCategory =
  | "BANKING_INFO"
  | "SSN_ONLY"
  | "FULL_INTAKE"
  | "ID_UPLOAD"
  | "CUSTOM_FORM";

export type SubmissionIndexEntry = {
  id: string;
  clientName: string | null;
  type: "FORM_SUBMISSION" | "LEGACY_SECURE_SUBMISSION" | "ID_UPLOAD";
  category: SubmissionCategory;
  typeLabel: string;
  createdAt: Date;
  viewedAt: Date | null;
  href: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  BANKING_INFO: "Banking Info",
  SSN_ONLY: "Social Security",
  FULL_INTAKE: "Full Intake",
  ID_UPLOAD: "Document Upload",
  CUSTOM_FORM: "Custom Form",
};

export function buildSubmissionsIndex(
  legacy: LegacySubmissionRow[],
  forms: FormSubmissionRow[],
  uploads: IdUploadRow[]
): SubmissionIndexEntry[] {
  const legacyRows: SubmissionIndexEntry[] = legacy.map((row) => ({
    id: row.id,
    clientName: row.link.clientName,
    type: "LEGACY_SECURE_SUBMISSION",
    category: (["BANKING_INFO", "SSN_ONLY", "FULL_INTAKE", "ID_UPLOAD"].includes(row.link.linkType)
      ? row.link.linkType
      : "FULL_INTAKE") as SubmissionCategory,
    typeLabel: CATEGORY_LABELS[row.link.linkType] ?? "Secure Submission",
    createdAt: row.createdAt,
    viewedAt: row.revealedAt,
    href: `/dashboard/submissions/${row.id}`,
  }));

  const formRows: SubmissionIndexEntry[] = forms.map((row) => ({
    id: row.id,
    clientName: row.formLink.clientName,
    type: "FORM_SUBMISSION",
    category: "CUSTOM_FORM" as SubmissionCategory,
    typeLabel: row.form.title,
    createdAt: row.createdAt,
    viewedAt: row.viewedAt,
    href: `/dashboard/forms/${row.formId}/submissions/${row.id}`,
  }));

  const uploadRows: SubmissionIndexEntry[] = uploads.map((row) => ({
    id: row.id,
    clientName: row.link.clientName,
    type: "ID_UPLOAD",
    category: "ID_UPLOAD" as SubmissionCategory,
    typeLabel: "Document Upload",
    createdAt: row.createdAt,
    viewedAt: row.viewedAt,
    href: `/dashboard/uploads/${row.id}`,
  }));

  return [...legacyRows, ...formRows, ...uploadRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
