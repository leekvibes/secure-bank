import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── helpers ───────────────────────────────────────────────────────────────────

type FieldDef = {
  label: string;
  fieldType: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  encrypted?: boolean;
  maskInput?: boolean;
  confirmField?: boolean;
  dropdownOptions?: string; // JSON string
};

function f(
  label: string,
  fieldType: string,
  opts: Partial<Omit<FieldDef, "label" | "fieldType">> = {}
): FieldDef {
  return { label, fieldType, ...opts };
}

function dd(options: string[]): string {
  return JSON.stringify(options);
}

type DocVar = {
  key: string;
  label: string;
  type: "text" | "multiline" | "address" | "date_text" | "currency_usd" | "email" | "phone" | "number";
  required: boolean;
  editable: boolean;
  section?: "SETUP" | "PARTY_A" | "PARTY_B" | "TERMS";
  maxLength?: number;
};

type DocClause = { id: string; label: string; required?: boolean; defaultEnabled?: boolean };

function baseDocumentVariables(): DocVar[] {
  return [
    { key: "effective_date_day", label: "Effective Date - Day of Month", type: "text", required: true, editable: true, section: "SETUP" },
    { key: "effective_date_month", label: "Effective Date - Month", type: "text", required: true, editable: true, section: "SETUP" },
    { key: "effective_date_year", label: "Effective Date - Year", type: "text", required: true, editable: true, section: "SETUP" },
    { key: "effective_date", label: "Effective Date (Full)", type: "date_text", required: false, editable: true, section: "SETUP" },
    { key: "party_a_name", label: "Party A Legal Name", type: "text", required: true, editable: true, section: "PARTY_A" },
    { key: "party_a_entity_type", label: "Party A Entity Type", type: "text", required: false, editable: true, section: "PARTY_A" },
    { key: "party_a_address", label: "Party A Address", type: "address", required: true, editable: true, section: "PARTY_A" },
    { key: "party_a_title", label: "Party A Title", type: "text", required: false, editable: true, section: "PARTY_A" },
    { key: "party_a_email", label: "Party A Email", type: "email", required: false, editable: true, section: "PARTY_A" },
    { key: "party_a_phone", label: "Party A Phone", type: "phone", required: false, editable: true, section: "PARTY_A" },
    { key: "party_b_name", label: "Party B Legal Name", type: "text", required: true, editable: true, section: "PARTY_B" },
    { key: "party_b_entity_type", label: "Party B Entity Type", type: "text", required: false, editable: true, section: "PARTY_B" },
    { key: "party_b_address", label: "Party B Address", type: "address", required: true, editable: true, section: "PARTY_B" },
    { key: "party_b_title", label: "Party B Title", type: "text", required: false, editable: true, section: "PARTY_B" },
    { key: "party_b_email", label: "Party B Email", type: "email", required: false, editable: true, section: "PARTY_B" },
    { key: "party_b_phone", label: "Party B Phone", type: "phone", required: false, editable: true, section: "PARTY_B" },
    { key: "consideration", label: "Consideration / Amount", type: "currency_usd", required: false, editable: true, section: "TERMS" },
    { key: "term_start_date", label: "Term Start Date", type: "date_text", required: false, editable: true, section: "TERMS" },
    { key: "term_end_date", label: "Term End Date", type: "date_text", required: false, editable: true, section: "TERMS" },
    { key: "contract_duration_years", label: "Contract Duration (Years)", type: "number", required: false, editable: true, section: "TERMS" },
    { key: "governing_law_state", label: "Governing Law (State)", type: "text", required: true, editable: true, section: "TERMS" },
    { key: "governing_law_city", label: "Governing Law (City)", type: "text", required: false, editable: true, section: "TERMS" },
    { key: "governing_law_county", label: "Governing Law (County)", type: "text", required: false, editable: true, section: "TERMS" },
    { key: "custom_terms", label: "Additional Terms", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 3000 },
  ];
}

const baseDocumentClauses: DocClause[] = [
  { id: "confidentiality", label: "Confidentiality", required: false, defaultEnabled: false },
  { id: "indemnity", label: "Indemnification", required: false, defaultEnabled: false },
  { id: "termination", label: "Termination Rights", required: false, defaultEnabled: true },
  { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
  { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
];

function docSchema(
  title: string,
  body: string[],
  opts?: {
    extraVariables?: DocVar[];
    clauses?: DocClause[];
    clauseBlocks?: Array<{ id: string; text: string }>;
  },
): string {
  const variables = [...baseDocumentVariables(), ...(opts?.extraVariables ?? [])];
  const clauses = opts?.clauses ?? baseDocumentClauses;
  const clauseBlocks = opts?.clauseBlocks ?? [];

  return JSON.stringify({
    title,
    locale: "en-US",
    versionLabel: "v1",
    roles: ["PARTY_A", "PARTY_B"],
    variables,
    clauses,
    blocks: [
      { id: "h1", kind: "heading", text: title },
      {
        id: "preamble",
        kind: "paragraph",
        editable: true,
        text: "This agreement is made and entered into as of the {{effective_date_day}} day of {{effective_date_month}}, {{effective_date_year}} (the \"Effective Date\") by and between {{party_a_name}} (\"Party A\"), a/an {{party_a_entity_type}} located at {{party_a_address}}, and {{party_b_name}} (\"Party B\"), a/an {{party_b_entity_type}} located at {{party_b_address}} (collectively, the \"Parties\").",
      },
      {
        id: "purpose",
        kind: "paragraph",
        editable: true,
        text: "Purpose. The Parties enter into this agreement to define their rights, duties, and obligations regarding the subject matter described herein.",
      },
      ...body.map((text, index) => ({
        id: `section_${index + 1}`,
        kind: "paragraph",
        editable: true,
        text,
      })),
      {
        id: "term",
        kind: "paragraph",
        editable: true,
        text: "Term. Unless terminated earlier in accordance with this agreement, the term begins on {{term_start_date}} and continues through {{term_end_date}}. If specified by law or policy, the obligations in this agreement survive for {{contract_duration_years}} year(s).",
      },
      {
        id: "consideration",
        kind: "paragraph",
        editable: true,
        text: "Compensation / Consideration. Any fees or consideration due under this agreement shall be {{consideration}} unless otherwise agreed in writing.",
      },
      {
        id: "confidentiality",
        kind: "paragraph",
        clauseId: "confidentiality",
        editable: true,
        text: "Confidentiality. Each party shall protect confidential information received from the other party and use such information only as permitted by this agreement.",
      },
      {
        id: "indemnity",
        kind: "paragraph",
        clauseId: "indemnity",
        editable: true,
        text: "Indemnification. Each party agrees to indemnify and hold harmless the other party from claims arising from its own breach, negligence, or willful misconduct.",
      },
      {
        id: "termination",
        kind: "paragraph",
        clauseId: "termination",
        editable: true,
        text: "Termination. Either party may terminate this agreement upon written notice if the other party materially breaches and fails to cure within a reasonable period.",
      },
      {
        id: "governing_law",
        kind: "paragraph",
        clauseId: "governing_law",
        editable: true,
        text: "Governing Law. This agreement shall be governed by and construed in accordance with the laws of {{governing_law_state}}. Any action arising from this agreement shall be brought in courts located in {{governing_law_city}}, {{governing_law_county}}, {{governing_law_state}}, and each party consents to venue and jurisdiction therein.",
      },
      {
        id: "additional_terms",
        kind: "paragraph",
        clauseId: "additional_terms",
        editable: true,
        text: "Additional Terms. {{custom_terms}}",
      },
      ...clauseBlocks.map((item) => ({
        id: item.id,
        kind: "paragraph",
        clauseId: item.id,
        editable: true,
        text: item.text,
      })),
      { kind: "spacer", size: 18 },
      { id: "signature_heading", kind: "paragraph", text: "IN WITNESS WHEREOF, the parties have executed this agreement.", editable: true },
      { id: "party_a_sign", kind: "paragraph", text: "PARTY A\nSignature: ______________________\nName: {{party_a_name}}\nTitle: {{party_a_title}}\nEmail: {{party_a_email}}\nPhone: {{party_a_phone}}\nDate: ______________________" },
      { id: "party_b_sign", kind: "paragraph", text: "PARTY B\nSignature: ______________________\nName: {{party_b_name}}\nTitle: {{party_b_title}}\nEmail: {{party_b_email}}\nPhone: {{party_b_phone}}\nDate: ______________________" },
    ],
  });
}

function docSigningDefaults(): string {
  return JSON.stringify([
    { type: "FULL_NAME", role: "PARTY_A", page: 1, x: 0.1, y: 0.84, width: 0.2, height: 0.04, required: true },
    { type: "SIGNATURE", role: "PARTY_A", page: 1, x: 0.32, y: 0.84, width: 0.22, height: 0.05, required: true },
    { type: "DATE_SIGNED", role: "PARTY_A", page: 1, x: 0.56, y: 0.84, width: 0.16, height: 0.04, required: true },
    { type: "FULL_NAME", role: "PARTY_B", page: 1, x: 0.1, y: 0.91, width: 0.2, height: 0.04, required: true },
    { type: "SIGNATURE", role: "PARTY_B", page: 1, x: 0.32, y: 0.91, width: 0.22, height: 0.05, required: true },
    { type: "DATE_SIGNED", role: "PARTY_B", page: 1, x: 0.56, y: 0.91, width: 0.16, height: 0.04, required: true },
  ]);
}

function docDefaultValues(extra?: Record<string, string>): string {
  return JSON.stringify({
    effective_date_day: "30",
    effective_date_month: "March",
    effective_date_year: "2026",
    governing_law_state: "California",
    governing_law_city: "Los Angeles",
    governing_law_county: "Los Angeles",
    ...extra,
  });
}

// ── template definitions ──────────────────────────────────────────────────────

const TEMPLATES: Array<{
  id: string;
  title: string;
  description: string;
  category: string;
  industry: string;
  type: "SECURE_LINK" | "FORM" | "DOCUMENT";
  linkType?: string;
  optionsJson?: string;
  fields?: FieldDef[];
  docSchemaJson?: string;
  docDefaultValuesJson?: string;
  docSigningDefaultsJson?: string;
  docVersion?: number;
  docStatus?: "DRAFT" | "REVIEWED" | "PUBLISHED" | "ARCHIVED";
  thumbnailUrl?: string;
  previewBlobUrl?: string;
  tags: string;
  isFeatured: boolean;
  complianceGuarded: boolean;
  coreFieldLabels?: string[]; // labels of fields that are "locked" in guarded mode
}> = [
  // ── Original 10 (insurance / banking) ─────────────────────────────────────

  {
    id: "tpl-bank-account-collection",
    title: "Bank Account Collection",
    description: "Securely collect routing number, account number, and account type from a client.",
    category: "Banking",
    industry: "BANKING",
    type: "SECURE_LINK",
    linkType: "BANKING_INFO",
    optionsJson: JSON.stringify({ collectBothAccounts: false }),
    tags: "banking,routing,account",
    isFeatured: true,
    complianceGuarded: false,
  },
  {
    id: "tpl-ssn-tax-id-collection",
    title: "SSN / Tax ID Collection",
    description: "Collect a Social Security Number or Tax ID for applications and verifications.",
    category: "Compliance",
    industry: "GENERAL",
    type: "SECURE_LINK",
    linkType: "SSN_ONLY",
    tags: "ssn,tax,compliance,identity",
    isFeatured: false,
    complianceGuarded: false,
  },
  {
    id: "tpl-photo-id-verification",
    title: "Photo ID Verification",
    description: "Ask your client to upload a government-issued photo ID (driver's license or passport).",
    category: "Compliance",
    industry: "GENERAL",
    type: "SECURE_LINK",
    linkType: "ID_UPLOAD",
    optionsJson: JSON.stringify({ documentType: "DRIVERS_LICENSE" }),
    tags: "id,identity,kyc,compliance",
    isFeatured: true,
    complianceGuarded: false,
  },
  {
    id: "tpl-full-client-intake",
    title: "Full Client Intake",
    description: "Collect personal info, SSN, and banking details in a single secure link.",
    category: "Insurance",
    industry: "INSURANCE",
    type: "SECURE_LINK",
    linkType: "FULL_INTAKE",
    tags: "intake,full,insurance,banking",
    isFeatured: true,
    complianceGuarded: false,
  },
  {
    id: "tpl-auto-insurance-quote",
    title: "Auto Insurance Quote",
    description: "Collect driver info, vehicle details, and contact info for an auto insurance quote.",
    category: "Insurance",
    industry: "INSURANCE",
    type: "FORM",
    tags: "auto,vehicle,insurance,quote",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Full Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Home Address", "address", { required: true }),
      f("Vehicle Year", "text", { placeholder: "e.g. 2021", required: true }),
      f("Vehicle Make & Model", "text", { placeholder: "e.g. Toyota Camry", required: true }),
      f("VIN Number", "text", { required: false, encrypted: true }),
      f("Current Insurance Provider", "text", { required: false }),
      f("Social Security Number", "ssn", { required: false, encrypted: true, maskInput: true, helpText: "Required for MVR check" }),
    ],
  },
  {
    id: "tpl-life-insurance-application",
    title: "Life Insurance Application",
    description: "Collect personal, health, and beneficiary information for a life insurance application.",
    category: "Insurance",
    industry: "INSURANCE",
    type: "FORM",
    tags: "life,insurance,application,beneficiary",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Full Legal Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Home Address", "address", { required: true }),
      f("Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Coverage Amount Requested", "dropdown", { required: true, dropdownOptions: dd(["$250,000","$500,000","$750,000","$1,000,000","$2,000,000+"]) }),
      f("Tobacco Use in Last 12 Months?", "dropdown", { required: true, dropdownOptions: dd(["No","Yes"]) }),
      f("Primary Beneficiary Name", "text", { required: true }),
      f("Beneficiary Relationship", "dropdown", { required: true, dropdownOptions: dd(["Spouse","Child","Parent","Sibling","Other"]) }),
    ],
  },
  {
    id: "tpl-health-insurance-enrollment",
    title: "Health Insurance Enrollment",
    description: "Gather personal details and coverage preferences for health insurance enrollment.",
    category: "Insurance",
    industry: "INSURANCE",
    type: "FORM",
    tags: "health,insurance,enrollment,aca",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Full Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Home Address", "address", { required: true }),
      f("Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Employer Name", "text", { required: false }),
      f("Household Size", "dropdown", { required: true, dropdownOptions: dd(["1","2","3","4","5","6+"]) }),
      f("Annual Household Income", "text", { placeholder: "e.g. $55,000", required: true, encrypted: true }),
      f("Preferred Coverage Type", "dropdown", { required: false, dropdownOptions: dd(["HMO","PPO","EPO","HDHP – HSA Compatible","No Preference"]) }),
    ],
  },
  {
    id: "tpl-mortgage-pre-qualification",
    title: "Mortgage Pre-Qualification",
    description: "Collect income, assets, and banking info needed to pre-qualify a mortgage applicant.",
    category: "Mortgage",
    industry: "MORTGAGE",
    type: "FORM",
    tags: "mortgage,loan,prequalification,banking",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Full Legal Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Current Address", "address", { required: true }),
      f("Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Gross Annual Income", "text", { placeholder: "e.g. $90,000", required: true, encrypted: true }),
      f("Employment Status", "dropdown", { required: true, dropdownOptions: dd(["Employed Full-Time","Employed Part-Time","Self-Employed","Retired","Other"]) }),
      f("Bank Routing Number", "routing", { required: true, encrypted: true, maskInput: true }),
      f("Bank Account Number", "bank_account", { required: true, encrypted: true, maskInput: true, confirmField: true }),
    ],
  },
  {
    id: "tpl-medicare-supplement-enrollment",
    title: "Medicare Supplement Enrollment",
    description: "Collect Medicare details, personal info, and current coverage for supplement enrollment.",
    category: "Insurance",
    industry: "INSURANCE",
    type: "FORM",
    tags: "medicare,supplement,enrollment,senior",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Full Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Home Address", "address", { required: true }),
      f("Medicare Beneficiary Identifier (MBI)", "text", { required: true, encrypted: true, maskInput: true, helpText: "Found on your red, white, and blue Medicare card" }),
      f("Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Part A Effective Date", "date", { required: false }),
      f("Part B Effective Date", "date", { required: false }),
      f("Desired Supplement Plan", "dropdown", { required: false, dropdownOptions: dd(["Plan G","Plan N","Plan F","Plan K","Plan L","Not Sure"]) }),
    ],
  },
  {
    id: "tpl-business-banking-setup",
    title: "Business Banking Setup",
    description: "Collect business entity info, EIN, and banking details for a new business account.",
    category: "Banking",
    industry: "BANKING",
    type: "FORM",
    tags: "business,banking,ein,account",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Business Legal Name", "text", { required: true }),
      f("DBA / Trade Name", "text", { required: false }),
      f("Employer Identification Number (EIN)", "text", { required: true, encrypted: true, maskInput: true }),
      f("Business Type", "dropdown", { required: true, dropdownOptions: dd(["Sole Proprietorship","LLC","S-Corp","C-Corp","Partnership","Non-Profit"]) }),
      f("Business Address", "address", { required: true }),
      f("Owner Full Name", "text", { required: true }),
      f("Owner Date of Birth", "date", { required: true }),
      f("Owner Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Bank Routing Number", "routing", { required: true, encrypted: true, maskInput: true }),
      f("Bank Account Number", "bank_account", { required: true, encrypted: true, maskInput: true, confirmField: true }),
    ],
  },

  // ── HR & Compliance (new 10) ───────────────────────────────────────────────

  {
    id: "tpl-w9-contractor-tax-intake",
    title: "W-9 Contractor Tax Intake",
    description: "IRS-aligned intake to collect taxpayer name, classification, address, TIN, and certification. Use as a precursor to issuing a 1099.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "w9,contractor,tax,irs,tin,1099",
    isFeatured: true,
    complianceGuarded: true,
    coreFieldLabels: ["Legal Name", "Federal Tax Classification", "Address", "TIN Type", "Taxpayer ID Number", "FATCA / Backup Withholding Certification", "Signature", "Date"],
    fields: [
      f("Legal Name", "text", { required: true, helpText: "Name as shown on your income tax return" }),
      f("Business / Disregarded Entity Name", "text", { required: false, helpText: "If different from above — leave blank if same" }),
      f("Federal Tax Classification", "dropdown", { required: true, dropdownOptions: dd(["Individual / Sole Proprietor","C Corporation","S Corporation","Partnership","Trust / Estate","LLC – Single Member (Disregarded)","LLC – C Corp Election","LLC – S Corp Election","LLC – Partnership Election","Other"]) }),
      f("Exempt Payee Code (if any)", "text", { required: false, helpText: "Leave blank if not applicable" }),
      f("FATCA Exemption Code (if any)", "text", { required: false, helpText: "Leave blank if not applicable" }),
      f("Address", "address", { required: true }),
      f("TIN Type", "dropdown", { required: true, dropdownOptions: dd(["Social Security Number (SSN)","Employer Identification Number (EIN)"]) }),
      f("Taxpayer ID Number", "ssn", { required: true, encrypted: true, maskInput: true, helpText: "SSN or EIN — encrypted and stored securely" }),
      f("FATCA / Backup Withholding Certification", "dropdown", { required: true, dropdownOptions: dd(["I certify that the TIN provided is correct, I am not subject to backup withholding, and I am a U.S. person"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-w4-employee-withholding-intake",
    title: "W-4 Employee Withholding Intake",
    description: "IRS-aligned intake for employee federal withholding elections. Employer transfers into official W-4 on file.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "w4,employee,withholding,irs,payroll,tax",
    isFeatured: true,
    complianceGuarded: true,
    coreFieldLabels: ["Filing Status", "Signature", "Date"],
    fields: [
      f("Full Legal Name", "text", { required: true }),
      f("SSN (last 4 for verification)", "text", { required: false, encrypted: true, maskInput: true, helpText: "Optional — for employer records only" }),
      f("Filing Status", "dropdown", { required: true, dropdownOptions: dd(["Single or Married Filing Separately","Married Filing Jointly (or Qualifying Surviving Spouse)","Head of Household"]) }),
      f("Multiple Jobs or Spouse Also Works?", "dropdown", { required: true, dropdownOptions: dd(["Yes","No"]) }),
      f("Claim Dependents — Total Amount", "text", { required: false, encrypted: true, placeholder: "e.g. $2,000", helpText: "From Step 3 of IRS W-4 worksheet" }),
      f("Other Income Not From Jobs (annual)", "text", { required: false, encrypted: true, placeholder: "e.g. $3,000" }),
      f("Deductions (if itemizing)", "text", { required: false, encrypted: true, placeholder: "e.g. $14,000" }),
      f("Additional Withholding Per Pay Period", "text", { required: false, encrypted: true, placeholder: "e.g. $50" }),
      f("Exempt From Withholding?", "dropdown", { required: true, dropdownOptions: dd(["No — withhold per elections above","Yes — I meet both IRS exemption conditions"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-i9-section1-work-authorization",
    title: "I-9 Section 1 — Work Authorization Intake",
    description: "USCIS-aligned Section 1 intake. Employee self-attests identity and work authorization. Note: employer must still complete Section 2 with document verification.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "i9,uscis,i-9,immigration,work,authorization,employment,eligibility",
    isFeatured: true,
    complianceGuarded: true,
    coreFieldLabels: ["Last Name", "First Name", "Date of Birth", "Citizenship / Immigration Status", "Employee Attestation", "Signature", "Date"],
    fields: [
      f("Last Name (Family Name)", "text", { required: true }),
      f("First Name (Given Name)", "text", { required: true }),
      f("Middle Initial", "text", { required: false }),
      f("Other Last Names Used (maiden, etc.)", "text", { required: false }),
      f("Current Address", "address", { required: true }),
      f("Date of Birth", "date", { required: true, encrypted: true }),
      f("U.S. Social Security Number", "ssn", { required: false, encrypted: true, maskInput: true, helpText: "Required only if your employer participates in E-Verify" }),
      f("Email Address", "email", { required: false }),
      f("Phone Number", "phone", { required: false }),
      f("Citizenship / Immigration Status", "dropdown", { required: true, dropdownOptions: dd(["A citizen of the United States","A noncitizen national of the United States","A lawful permanent resident","An alien authorized to work until the date below"]) }),
      f("Alien Registration / USCIS Number (if applicable)", "text", { required: false, encrypted: true, helpText: "A-Number or USCIS Number — starts with A" }),
      f("Form I-94 Admission Number (if applicable)", "text", { required: false, encrypted: true }),
      f("Foreign Passport Number (if applicable)", "text", { required: false, encrypted: true }),
      f("Country of Issuance (if applicable)", "text", { required: false }),
      f("Work Authorization Expiration Date (if applicable)", "date", { required: false }),
      f("Document List Note", "text", { required: false, helpText: "List A (e.g. Passport) OR List B + List C (e.g. Driver License + SSN Card). Your employer will complete Section 2 after reviewing originals." }),
      f("Employee Attestation", "dropdown", { required: true, dropdownOptions: dd(["I attest, under penalty of perjury, that I am aware that federal law provides for imprisonment and/or fines for false statements or use of false documents in connection with the completion of this form"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-direct-deposit-authorization",
    title: "Direct Deposit Authorization",
    description: "Collect employee or contractor banking info to set up direct deposit with a signed authorization.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "direct deposit,payroll,banking,ach,routing,employee",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Employee / Contractor Name", "text", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Bank Name", "text", { required: true }),
      f("Bank Routing Number", "routing", { required: true, encrypted: true, maskInput: true }),
      f("Bank Account Number", "bank_account", { required: true, encrypted: true, maskInput: true, confirmField: true }),
      f("Account Type", "dropdown", { required: true, dropdownOptions: dd(["Checking","Savings"]) }),
      f("Deposit Amount", "dropdown", { required: true, dropdownOptions: dd(["100% of net pay","Partial amount (specify in notes)","Split between accounts (specify in notes)"]) }),
      f("Notes / Special Instructions", "text", { required: false }),
      f("Authorization", "dropdown", { required: true, dropdownOptions: dd(["I authorize the above-named company to initiate credit entries to my account and to reverse any erroneous entries"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-independent-contractor-onboarding",
    title: "Independent Contractor Onboarding",
    description: "Full onboarding intake for new contractors — identity, contact, service type, tax profile, and payment method.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "contractor,onboarding,1099,freelance,independent",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Legal Name", "text", { required: true }),
      f("Business / DBA Name", "text", { required: false }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Business Address", "address", { required: true }),
      f("Service / Work Description", "text", { required: true, placeholder: "e.g. Software development, bookkeeping, design" }),
      f("Federal Tax Classification", "dropdown", { required: true, dropdownOptions: dd(["Sole Proprietor / Individual","Single-Member LLC","Partnership / Multi-Member LLC","S Corporation","C Corporation"]) }),
      f("SSN or EIN", "ssn", { required: true, encrypted: true, maskInput: true, helpText: "Used for 1099 reporting" }),
      f("Payment Method Preference", "dropdown", { required: true, dropdownOptions: dd(["Direct Deposit (ACH)","Check","Wire Transfer","Other"]) }),
      f("Anticipated Start Date", "date", { required: false }),
      f("Acknowledgment", "dropdown", { required: true, dropdownOptions: dd(["I confirm that all information provided is accurate and I understand I am engaged as an independent contractor, not an employee"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-employee-emergency-contact",
    title: "Employee Emergency Contact & Medical Notes",
    description: "Collect primary and secondary emergency contacts, relationship, and optional medical/allergy notes with signed consent.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "emergency contact,employee,medical,allergy,hr",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Employee Full Name", "text", { required: true }),
      f("Employee Email", "email", { required: false }),
      f("Primary Emergency Contact Name", "text", { required: true }),
      f("Primary Contact Relationship", "dropdown", { required: true, dropdownOptions: dd(["Spouse / Partner","Parent","Sibling","Child","Friend","Other"]) }),
      f("Primary Contact Phone", "phone", { required: true }),
      f("Primary Contact Email", "email", { required: false }),
      f("Secondary Emergency Contact Name", "text", { required: false }),
      f("Secondary Contact Relationship", "dropdown", { required: false, dropdownOptions: dd(["Spouse / Partner","Parent","Sibling","Child","Friend","Other"]) }),
      f("Secondary Contact Phone", "phone", { required: false }),
      f("Secondary Contact Email", "email", { required: false }),
      f("Known Medical Conditions / Allergies", "text", { required: false, encrypted: true, helpText: "e.g. Penicillin allergy, diabetes, EpiPen required" }),
      f("Current Medications", "text", { required: false, encrypted: true }),
      f("Special Instructions for Emergency Responders", "text", { required: false, encrypted: true }),
      f("Consent", "dropdown", { required: true, dropdownOptions: dd(["I consent to this information being securely stored and shared with emergency responders if necessary"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-background-check-consent-fcra",
    title: "Background Check Consent (FCRA)",
    description: "FCRA-compliant disclosure and authorization for consumer background reports. Includes standalone disclosure, written authorization, and rights acknowledgment.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "background check,fcra,consent,authorization,screening,hr",
    isFeatured: false,
    complianceGuarded: true,
    coreFieldLabels: ["Applicant Full Name", "Date of Birth", "Social Security Number", "FCRA Disclosure Acknowledgment", "Written Authorization", "Applicant Rights Acknowledgment", "Signature", "Date"],
    fields: [
      f("Applicant Full Name", "text", { required: true }),
      f("Date of Birth", "date", { required: true, encrypted: true }),
      f("Social Security Number", "ssn", { required: true, encrypted: true, maskInput: true }),
      f("Current Address", "address", { required: true }),
      f("Previous Address (if less than 2 years at current)", "text", { required: false }),
      f("Driver's License Number and State (if applicable)", "text", { required: false, encrypted: true }),
      f("FCRA Disclosure Acknowledgment", "dropdown", { required: true, dropdownOptions: dd(["I have received, read, and understand the standalone written disclosure that a consumer report may be obtained for employment purposes"]) }),
      f("Written Authorization", "dropdown", { required: true, dropdownOptions: dd(["I authorize the company and its designated consumer reporting agency to obtain a consumer report and/or investigative consumer report about me"]) }),
      f("Applicant Rights Acknowledgment", "dropdown", { required: true, dropdownOptions: dd(["I acknowledge receipt of 'A Summary of Your Rights Under the Fair Credit Reporting Act'"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-nda-acknowledgment-esign",
    title: "NDA Acknowledgment & E-Sign",
    description: "Capture party details, effective date, and a binding e-signature acknowledging receipt and agreement to the terms of a non-disclosure agreement.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "nda,non-disclosure,confidentiality,agreement,esign",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Full Legal Name", "text", { required: true }),
      f("Title / Role", "text", { required: false }),
      f("Company / Organization", "text", { required: false }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: false }),
      f("Effective Date of Agreement", "date", { required: true }),
      f("NDA Summary Acknowledgment", "dropdown", { required: true, dropdownOptions: dd(["I have read and understand the Non-Disclosure Agreement presented to me"]) }),
      f("Agreement to Terms", "dropdown", { required: true, dropdownOptions: dd(["I agree to be legally bound by the terms of this Non-Disclosure Agreement"]) }),
      f("Confidential Information Description (optional)", "text", { required: false, helpText: "Briefly describe the nature of information covered, if applicable" }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-offer-letter-acceptance",
    title: "Offer Letter Acceptance",
    description: "Candidate confirms position, start date, and compensation details, then accepts or declines with a binding e-signature.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "FORM",
    tags: "offer letter,hiring,acceptance,onboarding,hr,candidate",
    isFeatured: false,
    complianceGuarded: false,
    fields: [
      f("Candidate Full Name", "text", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: false }),
      f("Position / Job Title", "text", { required: true }),
      f("Department / Team", "text", { required: false }),
      f("Proposed Start Date", "date", { required: true }),
      f("Employment Type", "dropdown", { required: true, dropdownOptions: dd(["Full-Time","Part-Time","Contract","Temporary","Internship"]) }),
      f("Compensation Summary", "text", { required: false, encrypted: true, placeholder: "e.g. $85,000/yr base + benefits", helpText: "Encrypted — only you can view" }),
      f("Decision", "dropdown", { required: true, dropdownOptions: dd(["I accept this offer and agree to the terms outlined","I decline this offer"]) }),
      f("Questions or Comments", "text", { required: false }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  {
    id: "tpl-general-new-client-secure-intake",
    title: "General New Client Secure Intake",
    description: "Flexible all-purpose intake — identity, contact, address, optional SSN/TIN, optional banking, file upload notes, and signed consent.",
    category: "General",
    industry: "GENERAL",
    type: "FORM",
    tags: "intake,general,client,onboarding,identity",
    isFeatured: true,
    complianceGuarded: false,
    fields: [
      f("Full Name", "text", { required: true }),
      f("Email Address", "email", { required: true }),
      f("Phone Number", "phone", { required: true }),
      f("Home / Business Address", "address", { required: true }),
      f("Date of Birth", "date", { required: false, encrypted: true }),
      f("Social Security Number or TIN", "ssn", { required: false, encrypted: true, maskInput: true, helpText: "Optional — only provide if requested by your agent" }),
      f("Bank Routing Number", "routing", { required: false, encrypted: true, maskInput: true }),
      f("Bank Account Number", "bank_account", { required: false, encrypted: true, maskInput: true, confirmField: true }),
      f("Document Upload Notes", "text", { required: false, helpText: "List any documents you intend to provide separately (e.g. photo ID, proof of income)" }),
      f("Consent", "dropdown", { required: true, dropdownOptions: dd(["I authorize submission of the above information and confirm it is accurate to the best of my knowledge"]) }),
      f("Signature", "signature", { required: true }),
      f("Date", "date", { required: true }),
    ],
  },
  // ── Document Templates (new) ───────────────────────────────────────────────
  {
    id: "tpl-doc-nda-v1",
    title: "Non-Disclosure Agreement",
    description: "Mutual NDA template with signature-ready sections.",
    category: "Compliance",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "nda,confidentiality,document,signature",
    isFeatured: true,
    complianceGuarded: false,
    docSchemaJson: docSchema("Non-Disclosure Agreement", [
      "1. Definition of Confidential Information. \"Confidential Information\" means all non-public, proprietary, technical, operational, strategic, customer, financial, and trade-secret information disclosed by either party in any form, including examples such as {{confidential_information_examples}}.",
      "2. Purpose and Permitted Use. Receiving party may use Confidential Information solely for {{confidential_information_purpose}} and for no unrelated purpose without prior written consent from disclosing party.",
      "3. Non-Disclosure Duty. Receiving party shall not disclose Confidential Information except to representatives with a strict need-to-know who are bound by obligations at least as protective as this Agreement.",
      "4. Standard of Care. Receiving party shall protect Confidential Information using no less than a reasonable standard of care and, at minimum, the same level of care used to protect its own sensitive information.",
      "5. Exclusions. Confidential Information excludes information that is public without breach, already lawfully known, independently developed without use of disclosed information, or lawfully received from an unrestricted third party.",
      "6. Compelled Disclosure. If legally compelled to disclose Confidential Information, receiving party shall provide prompt notice (where legally permitted) and disclose only the minimum legally required.",
      "7. Term and Survival. This Agreement takes effect on {{effective_date_month}} {{effective_date_day}}, {{effective_date_year}} and confidentiality obligations continue for {{contract_duration_years}} year(s) after termination, or longer as required by applicable law for trade secrets.",
      "8. Return or Destruction. Upon request or termination, receiving party shall promptly return or securely destroy Confidential Information, except archival copies retained solely for legal/compliance purposes.",
      "9. Remedies. Parties agree unauthorized disclosure may cause irreparable harm and that equitable relief may be sought in addition to monetary damages and other legal remedies.",
      "10. Entire Agreement. This Agreement supersedes prior discussions on confidentiality between {{party_a_name}} and {{party_b_name}} and may be amended only in a signed writing.",
    ], {
      extraVariables: [
        { key: "confidential_information_purpose", label: "Confidential Information Purpose", type: "multiline", required: true, editable: true, section: "TERMS", maxLength: 1200 },
        { key: "confidential_information_examples", label: "Confidential Information Examples", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 1200 },
      ],
      clauses: [
        { id: "confidentiality", label: "Confidentiality", required: true, defaultEnabled: true },
        { id: "non_solicitation", label: "Non-Solicitation", required: false, defaultEnabled: false },
        { id: "non_circumvention", label: "Non-Circumvention", required: false, defaultEnabled: false },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "non_solicitation", text: "Non-Solicitation. During the term and for a reasonable period thereafter, each party agrees not to directly solicit key employees or contractors of the other party using Confidential Information obtained under this Agreement." },
        { id: "non_circumvention", text: "Non-Circumvention. Neither party shall use Confidential Information to bypass the other party in business opportunities first introduced through the relationship governed by this Agreement." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      contract_duration_years: "3",
      confidential_information_purpose: "evaluating and supporting a potential business relationship between the parties",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-offer-letter-v1",
    title: "Offer Letter",
    description: "Employment offer letter template with acceptance signature block.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "offer letter,employment,document,signature",
    isFeatured: true,
    complianceGuarded: false,
    docSchemaJson: docSchema("Offer Letter", [
      "1. Offer and Position. {{party_a_name}} hereby offers {{party_b_name}} the position of {{position_title}}, reporting to {{manager_name}}, subject to the terms of this Offer Letter.",
      "2. Start Date and Work Location. Anticipated start date is {{term_start_date}} and primary work location is {{work_location}}. Work arrangement details (on-site/hybrid/remote) are determined by employer policy.",
      "3. Base Compensation. Employee will receive base compensation of {{consideration}} in accordance with employer payroll practices and lawful withholdings.",
      "4. Bonus/Commission Eligibility. Bonus/commission summary: {{bonus_summary}}. Eligibility remains governed by applicable plan documents, metrics, and management discretion unless otherwise guaranteed in writing.",
      "5. Benefits and Time Off. Employee may be eligible for benefits under employer plans, as amended from time to time, subject to plan terms and applicable law.",
      "6. Contingencies. This offer is contingent upon identity/work authorization verification, truthful application disclosures, and successful completion of required checks permitted by law.",
      "7. Confidentiality and Proprietary Rights. As a condition of employment, employee agrees to maintain confidentiality and execute proprietary rights/IP assignment documentation as required.",
      "8. At-Will Employment. Unless otherwise required by law or contract, employment is at-will and may be terminated by either party at any time, with or without cause or notice.",
      "9. Entire Offer and Governing Law. This letter supersedes prior oral or written offer discussions and is governed by laws of {{governing_law_state}}.",
      "10. Acceptance. Employee must sign and return this letter by {{term_end_date}} to accept this offer.",
    ], {
      extraVariables: [
        { key: "position_title", label: "Position Title", type: "text", required: true, editable: true, section: "SETUP" },
        { key: "manager_name", label: "Hiring Manager Name", type: "text", required: false, editable: true, section: "SETUP" },
        { key: "work_location", label: "Work Location", type: "text", required: false, editable: true, section: "TERMS" },
        { key: "bonus_summary", label: "Bonus/Commission Summary", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 1200 },
      ],
      clauses: [
        { id: "background_check", label: "Background Check Contingency", required: false, defaultEnabled: true },
        { id: "confidentiality", label: "Confidentiality", required: true, defaultEnabled: true },
        { id: "termination", label: "At-Will/Termination", required: true, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "background_check", text: "Background Check Contingency. This offer remains contingent on completion of legally permitted screening and verification checks required by employer policy." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      position_title: "Account Executive",
      manager_name: "Hiring Manager",
      work_location: "Los Angeles, CA",
      bonus_summary: "Eligible for annual discretionary performance bonus under company plan terms.",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-invoice-v1",
    title: "Invoice",
    description: "Invoice document template with customer acceptance signature.",
    category: "Banking",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "invoice,billing,accounts receivable,document",
    isFeatured: false,
    complianceGuarded: false,
    docSchemaJson: docSchema("Invoice", [
      "1. Invoice Parties. This invoice is issued by {{party_a_name}} to {{party_b_name}} for goods and/or services provided.",
      "2. Scope of Work or Deliverables. The work covered by this invoice corresponds to the agreed services, deliverables, or items accepted by the client.",
      "3. Amount Due. Total invoiced amount is {{consideration}}, payable in accordance with this invoice and any governing agreement.",
      "4. Issue Date and Due Date. Invoice date is {{effective_date}} and payment due date is {{term_end_date}} unless the parties agree otherwise in writing.",
      "5. Payment Terms. Approved payment method and remittance details are provided by {{party_a_name}} and must be followed for timely processing.",
      "6. Disputes. Any billing dispute must be submitted in writing within a commercially reasonable period after receipt of this invoice.",
      "7. Late Payment. Late balances may incur fees or interest to the extent allowed by applicable law and governing contract terms.",
      "8. Confirmation. By signing, {{party_b_name}} confirms receipt and acceptance of the invoiced goods/services.",
    ], {
      extraVariables: [
        { key: "invoice_number", label: "Invoice Number", type: "text", required: true, editable: true, section: "SETUP" },
        { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "late_fee", label: "Late Fee", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "late_fee", text: "Late Fee. Amounts outstanding after due date may accrue late charges and/or interest to the maximum extent permitted by applicable law and agreement terms." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      invoice_number: "INV-2026-001",
      payment_terms_days: "15",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-purchase-order-v1",
    title: "Purchase Order",
    description: "Purchase order template for ordering goods/services.",
    category: "Banking",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "purchase order,procurement,document",
    isFeatured: false,
    complianceGuarded: false,
    docSchemaJson: docSchema("Purchase Order", [
      "1. Order Authorization. {{party_a_name}} issues this Purchase Order to {{party_b_name}} for fulfillment of requested goods and/or services.",
      "2. Description of Goods/Services. Supplier shall provide the items and specifications agreed by the parties, including quantity and quality standards.",
      "3. Pricing and Amount. Total authorized amount for this order is {{consideration}}, subject to any written amendments.",
      "4. Delivery Timeline. Performance begins on {{term_start_date}} and target completion or delivery date is {{term_end_date}}.",
      "5. Acceptance Criteria. Goods/services are subject to inspection and acceptance by {{party_a_name}} against agreed requirements.",
      "6. Invoicing and Payment. Supplier may invoice only accepted goods/services and payment will follow agreed payment terms.",
      "7. Changes and Cancellations. Changes to scope, pricing, or timing must be documented and approved in writing by authorized representatives.",
      "8. Supplier Acknowledgment. By signing, {{party_b_name}} accepts this Purchase Order and agrees to its terms as of {{effective_date}}.",
    ], {
      extraVariables: [
        { key: "po_number", label: "PO Number", type: "text", required: true, editable: true, section: "SETUP" },
        { key: "delivery_location", label: "Delivery Location", type: "address", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "inspection_rights", label: "Inspection Rights", required: false, defaultEnabled: true },
        { id: "termination", label: "Termination Rights", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "inspection_rights", text: "Inspection Rights. Buyer retains the right to inspect and reject non-conforming goods/services within a commercially reasonable period after delivery." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      po_number: "PO-2026-001",
      delivery_location: "123 Main St, Los Angeles, CA 90012",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-bill-of-sale-v1",
    title: "Bill of Sale",
    description: "General bill of sale template for transfer of property.",
    category: "General",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "bill of sale,asset transfer,document",
    isFeatured: true,
    complianceGuarded: false,
    docSchemaJson: docSchema("Bill of Sale", [
      "1. Parties and Effective Date. This Bill of Sale is entered on {{effective_date_month}} {{effective_date_day}}, {{effective_date_year}} by and between seller {{party_a_name}} and buyer {{party_b_name}}.",
      "2. Property Description. Seller transfers to Buyer all right, title, and interest in the following property: {{property_description}}.",
      "3. Identifying Information. Where applicable, the property includes identification/serial number: {{property_serial_number}}.",
      "4. Purchase Price and Payment Method. Buyer shall pay seller {{consideration}} by {{payment_method}} under the payment schedule mutually agreed in writing.",
      "5. Condition and Inspection. Property condition at transfer is {{item_condition}}. Buyer confirms opportunity to inspect and accepts condition except as expressly stated herein.",
      "6. Seller Representations. Seller represents lawful ownership, authority to transfer, and that seller has disclosed known liens, encumbrances, or ownership restrictions.",
      "7. Delivery and Possession. Delivery will occur at {{delivery_address}} on or before {{term_start_date}}, and risk of loss transfers upon actual delivery unless otherwise stated.",
      "8. Taxes, Fees, and Registration. Buyer is responsible for post-transfer taxes, title, and registration fees unless this agreement states otherwise.",
      "9. Governing Law. This Bill of Sale is governed by the laws of {{governing_law_state}}.",
      "10. Entire Agreement. This instrument is the full agreement regarding the sale and supersedes prior oral or written understandings.",
    ], {
      extraVariables: [
        { key: "property_description", label: "Property Description", type: "multiline", required: true, editable: true, section: "TERMS", maxLength: 1200 },
        { key: "delivery_address", label: "Delivery Address", type: "address", required: false, editable: true, section: "TERMS" },
        { key: "property_serial_number", label: "Property Serial/ID Number", type: "text", required: false, editable: true, section: "TERMS" },
        { key: "payment_method", label: "Payment Method", type: "text", required: false, editable: true, section: "TERMS" },
        { key: "item_condition", label: "Item Condition", type: "text", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "as_is_sale", label: "As-Is Sale", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "as_is_sale", text: "As-Is Sale. Except as expressly provided, buyer acknowledges the property is transferred on an \"as-is, where-is\" basis without additional warranties." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      property_description: "Office equipment package including laptops, monitors, and docking stations.",
      payment_method: "wire transfer",
      item_condition: "used, functional",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-lease-agreement-v1",
    title: "Lease Agreement",
    description: "Lease agreement template for landlord and tenant execution.",
    category: "General",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "lease,rental,property,document",
    isFeatured: false,
    complianceGuarded: false,
    docSchemaJson: docSchema("Lease Agreement", [
      "1. Parties and Premises. This Residential Lease Agreement is entered on {{effective_date_month}} {{effective_date_day}}, {{effective_date_year}} by landlord {{party_a_name}} and tenant {{party_b_name}} for premises at {{leased_premises_address}}.",
      "2. Term. Lease term begins {{term_start_date}} and ends {{term_end_date}} unless renewed, extended, or terminated under this agreement and applicable law.",
      "3. Rent. Tenant shall pay rent of {{consideration}} per month, due on day {{rent_due_day_each_month}} of each month, to the payment location/method designated by landlord.",
      "4. Security Deposit. Tenant shall pay a security deposit of {{security_deposit_amount}} to be held, applied, and returned in accordance with applicable law.",
      "5. Utilities and Services. Utility responsibility is allocated as follows: {{utility_responsibility}}.",
      "6. Occupancy and Use. Premises may be used solely for lawful residential occupancy by authorized occupants and may not be used for unlawful or nuisance activities.",
      "7. Maintenance and Access. Tenant shall maintain premises in clean/safe condition and promptly report defects; landlord may access premises with legally required notice except emergencies.",
      "8. Default and Remedies. Nonpayment of rent or material breach may result in notices, cure periods, fees, and legal remedies as allowed by law.",
      "9. Move-Out and Surrender. On termination, tenant shall vacate, return keys/access devices, and surrender premises in required condition, ordinary wear and tear excepted.",
      "10. Governing Law. This lease shall be interpreted and enforced under laws of {{governing_law_state}}.",
    ], {
      extraVariables: [
        { key: "leased_premises_address", label: "Leased Premises Address", type: "address", required: true, editable: true, section: "TERMS" },
        { key: "security_deposit_amount", label: "Security Deposit Amount", type: "currency_usd", required: false, editable: true, section: "TERMS" },
        { key: "rent_due_day_each_month", label: "Rent Due Day (1-31)", type: "number", required: false, editable: true, section: "TERMS" },
        { key: "utility_responsibility", label: "Utility Responsibility", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 1200 },
      ],
      clauses: [
        { id: "pets_policy", label: "Pets Policy", required: false, defaultEnabled: false },
        { id: "termination", label: "Termination Rights", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "pets_policy", text: "Pets Policy. Tenant may keep pets only as expressly permitted by landlord in writing, subject to applicable fees and compliance with building/community rules." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      rent_due_day_each_month: "1",
      utility_responsibility: "Tenant: electricity, internet, water. Landlord: property taxes and HOA dues.",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-loan-agreement-v1",
    title: "Loan Agreement",
    description: "Loan agreement template for lender and borrower.",
    category: "Banking",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "loan,lender,borrower,document",
    isFeatured: false,
    complianceGuarded: false,
    docSchemaJson: docSchema("Loan Agreement", [
      "1. Parties and Effective Date. This Loan Agreement is made on {{effective_date_month}} {{effective_date_day}}, {{effective_date_year}} between lender {{party_a_name}} and borrower {{party_b_name}}.",
      "2. Principal Amount and Purpose. Lender agrees to lend borrower principal sum of {{consideration}} for lawful purposes agreed by the parties.",
      "3. Interest. Principal bears interest at annual rate of {{interest_rate_annual}}%, calculated on the basis and schedule agreed by the parties and applicable law.",
      "4. Term and Maturity. Loan commences on {{term_start_date}} and matures on {{term_end_date}} unless accelerated, refinanced, or prepaid in accordance with this agreement.",
      "5. Payment Schedule. Borrower shall make {{payment_frequency}} payments in the amounts and on the dates set forth in the amortization/payment schedule.",
      "6. Application of Payments. Payments are applied first to permitted fees, then accrued interest, and then principal unless law requires a different order.",
      "7. Prepayment. Borrower may prepay principal in whole or in part as permitted by this agreement; any prepayment premium must be expressly disclosed.",
      "8. Default and Acceleration. Failure to pay, insolvency events, material misrepresentation, or covenant breaches may constitute default and permit acceleration/remedies.",
      "9. Collateral and Security Interest. If collateral is provided, borrower grants lender a security interest in: {{collateral_description}}.",
      "10. Governing Law and Notices. This agreement is governed by {{governing_law_state}} law and notices must be sent to addresses designated by each party.",
    ], {
      extraVariables: [
        { key: "interest_rate_annual", label: "Annual Interest Rate (%)", type: "number", required: false, editable: true, section: "TERMS" },
        { key: "collateral_description", label: "Collateral Description", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 1200 },
        { key: "payment_frequency", label: "Payment Frequency", type: "text", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "collateral", label: "Collateral", required: false, defaultEnabled: true },
        { id: "late_fee", label: "Late Fee", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "collateral", text: "Collateral. To secure repayment obligations, borrower grants lender a security interest in the following collateral: {{collateral_description}}." },
        { id: "late_fee", text: "Late Fee. If any payment is not made when due, lender may charge a reasonable late fee as permitted by law and this agreement." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      interest_rate_annual: "8.5",
      payment_frequency: "monthly",
      collateral_description: "UCC-identified business equipment and related proceeds.",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-liability-waiver-v1",
    title: "Liability Waiver",
    description: "Liability waiver and acknowledgment of risk template.",
    category: "Compliance",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "liability,waiver,risk,document",
    isFeatured: true,
    complianceGuarded: false,
    docSchemaJson: docSchema("Liability Waiver", [
      "1. Voluntary Participation. Participant {{party_b_name}} elects to engage in activities offered or administered by {{party_a_name}} as of {{effective_date}}.",
      "2. Assumption of Risk. Participant understands and accepts all known and unknown risks, including personal injury, property damage, or other loss.",
      "3. Health and Capability Representation. Participant affirms they are physically and legally capable of participating and will follow all instructions and safety guidance.",
      "4. Release and Hold Harmless. To the fullest extent permitted by law, participant releases and holds harmless {{party_a_name}} from claims arising from participation.",
      "5. Indemnity. Participant agrees to indemnify and defend released parties from third-party claims caused by participant's acts, omissions, or rule violations.",
      "6. Medical Treatment Authorization. In an emergency, participant authorizes reasonable medical treatment at participant cost unless prohibited by law.",
      "7. Severability. If any provision is held invalid, remaining provisions remain in effect to the maximum extent permitted by law.",
      "8. Governing Law. This waiver is interpreted under the laws of {{governing_law_state}} and remains binding on participant and permitted successors.",
    ], {
      extraVariables: [
        { key: "activity_description", label: "Activity Description", type: "multiline", required: true, editable: true, section: "SETUP", maxLength: 900 },
      ],
      clauses: [
        { id: "medical_authorization", label: "Medical Authorization", required: false, defaultEnabled: true },
        { id: "indemnity", label: "Indemnification", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "medical_authorization", text: "Medical Authorization. Participant authorizes emergency medical treatment if deemed necessary by qualified responders, with associated costs remaining participant responsibility where legally permitted." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues(),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-service-agreement-v1",
    title: "Service Agreement",
    description: "Service agreement template for provider and client engagements.",
    category: "General",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "service agreement,scope,document",
    isFeatured: true,
    complianceGuarded: false,
    docSchemaJson: docSchema("Service Agreement", [
      "1. Parties and Engagement. This Service Agreement is effective {{effective_date_month}} {{effective_date_day}}, {{effective_date_year}} between service provider {{party_a_name}} and client {{party_b_name}}.",
      "2. Scope of Services. Provider shall perform services described in this agreement and statements of work, including: {{service_scope_summary}}.",
      "3. Deliverables and Milestones. Provider deliverables include {{deliverables_schedule}} and will be completed according to commercially reasonable timelines.",
      "4. Term. Services commence on {{term_start_date}} and continue through {{term_end_date}}, unless earlier terminated under this agreement.",
      "5. Fees, Invoicing, and Payment. Client shall pay {{consideration}} under the invoicing/payment terms set forth herein. Undisputed invoices are due within {{payment_terms_days}} day(s).",
      "6. Client Cooperation. Client shall provide timely access, decisions, and approvals necessary for provider to perform services. Delays in client cooperation may reasonably extend delivery dates.",
      "7. Change Requests. Any scope, schedule, or fee changes must be approved in writing by authorized representatives of both parties.",
      "8. Confidentiality and Data Protection. Each party shall protect confidential information and process shared data only as necessary to perform this agreement.",
      "9. Warranties and Limitations. Provider warrants services will be performed in a professional manner; except as expressly stated, services are provided without additional implied warranties to the maximum extent permitted by law.",
      "10. Termination and Transition. On termination, each party remains liable for accrued obligations; provider will reasonably cooperate in transition of work product subject to payment of outstanding fees.",
    ], {
      extraVariables: [
        { key: "service_scope_summary", label: "Service Scope Summary", type: "multiline", required: true, editable: true, section: "TERMS", maxLength: 1500 },
        { key: "deliverables_schedule", label: "Deliverables & Milestones", type: "multiline", required: false, editable: true, section: "TERMS", maxLength: 1500 },
        { key: "payment_terms_days", label: "Payment Terms (Days)", type: "number", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "sla", label: "Service Levels", required: false, defaultEnabled: true },
        { id: "limitation_of_liability", label: "Limitation of Liability", required: false, defaultEnabled: true },
        { id: "termination", label: "Termination Rights", required: false, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
        { id: "additional_terms", label: "Additional Terms", required: false, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "sla", text: "Service Levels. Provider will use commercially reasonable efforts to meet delivery timelines, response commitments, and quality standards defined in the service scope." },
        { id: "limitation_of_liability", text: "Limitation of Liability. Except for obligations that cannot be limited by law, each party's aggregate liability arising out of this agreement shall be limited to amounts paid or payable under this agreement during the twelve months preceding the claim." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      service_scope_summary: "Professional onboarding, workflow setup, and monthly optimization support.",
      deliverables_schedule: "Week 1 discovery; Week 2 implementation; Week 3 handoff and training.",
      payment_terms_days: "15",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
  {
    id: "tpl-doc-independent-contractor-agreement-v1",
    title: "Independent Contractor Agreement",
    description: "Independent contractor agreement template with signature sections.",
    category: "HR & Compliance",
    industry: "GENERAL",
    type: "DOCUMENT",
    tags: "independent contractor,1099,agreement,document",
    isFeatured: false,
    complianceGuarded: false,
    docSchemaJson: docSchema("Independent Contractor Agreement", [
      "1. Relationship of Parties. Contractor {{party_b_name}} provides services to company {{party_a_name}} as an independent contractor and not as an employee, partner, or legal agent.",
      "2. Services and Deliverables. Contractor shall perform services described in this agreement, including deliverables identified as: {{deliverables_description}}.",
      "3. Term. Engagement commences on {{term_start_date}} and continues through {{term_end_date}} unless terminated earlier according to this agreement.",
      "4. Compensation and Invoicing. Contractor shall receive {{consideration}} and submit invoices on a {{invoice_schedule}} schedule with reasonable supporting documentation.",
      "5. Taxes, Insurance, and Compliance. Contractor is solely responsible for all taxes, benefits, licenses, permits, and insurance obligations applicable to contractor's business.",
      "6. Confidentiality. Contractor shall protect company confidential information and use it solely for performance under this agreement.",
      "7. Work Product and Intellectual Property. Work product created specifically for company under this agreement is owned by company to the extent permitted by law and subject to this agreement.",
      "8. Non-Solicitation and Conflicts. Contractor shall avoid conflicts of interest and comply with agreed restrictions regarding solicitation and use of company relationships.",
      "9. Termination. Either party may terminate for material breach after notice and a reasonable cure period, or immediately where permitted for serious misconduct.",
      "10. Governing Law. This agreement is governed by laws of {{governing_law_state}}.",
    ], {
      extraVariables: [
        { key: "deliverables_description", label: "Deliverables Description", type: "multiline", required: true, editable: true, section: "TERMS", maxLength: 1500 },
        { key: "invoice_schedule", label: "Invoice Schedule", type: "text", required: false, editable: true, section: "TERMS" },
      ],
      clauses: [
        { id: "ip_assignment", label: "IP Assignment", required: false, defaultEnabled: true },
        { id: "non_compete", label: "Non-Compete", required: false, defaultEnabled: false },
        { id: "non_solicitation", label: "Non-Solicitation", required: false, defaultEnabled: true },
        { id: "confidentiality", label: "Confidentiality", required: true, defaultEnabled: true },
        { id: "governing_law", label: "Governing Law", required: true, defaultEnabled: true },
      ],
      clauseBlocks: [
        { id: "ip_assignment", text: "IP Assignment. Contractor assigns to company all right, title, and interest in deliverables and work product created specifically under this engagement, subject to any agreed pre-existing materials carve-outs." },
        { id: "non_compete", text: "Non-Compete. For the period and scope permitted by applicable law, contractor agrees not to engage in direct competitive services that materially conflict with this engagement." },
        { id: "non_solicitation", text: "Non-Solicitation. During the engagement and for a reasonable period thereafter, contractor shall not directly solicit company employees or clients using confidential knowledge acquired through this relationship." },
      ],
    }),
    docDefaultValuesJson: docDefaultValues({
      deliverables_description: "Weekly campaign optimization reports and monthly performance strategy package.",
      invoice_schedule: "Bi-weekly",
    }),
    docSigningDefaultsJson: docSigningDefaults(),
    docVersion: 1,
    docStatus: "PUBLISHED",
  },
];

// ── seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding system templates...");

  for (const t of TEMPLATES) {
    const fieldsJson = t.fields ? JSON.stringify(t.fields) : null;
    const coreFieldLabels = t.coreFieldLabels ? JSON.stringify(t.coreFieldLabels) : null;

    await prisma.systemTemplate.upsert({
      where: { id: t.id },
      update: {
        title: t.title,
        description: t.description,
        category: t.category,
        industry: t.industry,
        type: t.type,
        linkType: t.linkType ?? null,
        optionsJson: t.optionsJson ?? null,
        fieldsJson,
        docSchemaJson: t.docSchemaJson ?? null,
        docDefaultValuesJson: t.docDefaultValuesJson ?? null,
        docSigningDefaultsJson: t.docSigningDefaultsJson ?? null,
        docVersion: t.docVersion ?? 1,
        docStatus: t.docStatus ?? "DRAFT",
        thumbnailUrl: t.thumbnailUrl ?? null,
        previewBlobUrl: t.previewBlobUrl ?? null,
        tags: t.tags,
        isFeatured: t.isFeatured,
        complianceGuarded: t.complianceGuarded,
        coreFieldLabels,
        isActive: true,
      },
      create: {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        industry: t.industry,
        type: t.type,
        linkType: t.linkType ?? null,
        optionsJson: t.optionsJson ?? null,
        fieldsJson,
        docSchemaJson: t.docSchemaJson ?? null,
        docDefaultValuesJson: t.docDefaultValuesJson ?? null,
        docSigningDefaultsJson: t.docSigningDefaultsJson ?? null,
        docVersion: t.docVersion ?? 1,
        docStatus: t.docStatus ?? "DRAFT",
        thumbnailUrl: t.thumbnailUrl ?? null,
        previewBlobUrl: t.previewBlobUrl ?? null,
        tags: t.tags,
        isFeatured: t.isFeatured,
        complianceGuarded: t.complianceGuarded,
        coreFieldLabels,
        isActive: true,
      },
    });
    console.log(`  ✓ ${t.title}`);
  }

  console.log(`\nSeeded ${TEMPLATES.length} system templates.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
