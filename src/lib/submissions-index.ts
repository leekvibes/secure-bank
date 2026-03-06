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

export type SubmissionIndexEntry = {
  id: string;
  clientName: string | null;
  type: "FORM_SUBMISSION" | "LEGACY_SECURE_SUBMISSION" | "ID_UPLOAD";
  typeLabel: string;
  createdAt: Date;
  viewedAt: Date | null;
  href: string;
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
    typeLabel: "Legacy secure submission",
    createdAt: row.createdAt,
    viewedAt: row.revealedAt,
    href: `/dashboard/submissions/${row.id}`,
  }));

  const formRows: SubmissionIndexEntry[] = forms.map((row) => ({
    id: row.id,
    clientName: row.formLink.clientName,
    type: "FORM_SUBMISSION",
    typeLabel: "Form submission",
    createdAt: row.createdAt,
    viewedAt: row.viewedAt,
    href: `/dashboard/forms/${row.formId}/submissions/${row.id}`,
  }));

  const uploadRows: SubmissionIndexEntry[] = uploads.map((row) => ({
    id: row.id,
    clientName: row.link.clientName,
    type: "ID_UPLOAD",
    typeLabel: "ID upload",
    createdAt: row.createdAt,
    viewedAt: row.viewedAt,
    href: `/dashboard/uploads/${row.id}`,
  }));

  return [...legacyRows, ...formRows, ...uploadRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
