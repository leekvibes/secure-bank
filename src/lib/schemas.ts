import { z } from "zod";
import {
  fieldsMatch,
  isValidRoutingNumberChecksum,
  isValidSsnFormat,
} from "@/lib/validation";

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  displayName: z.string().min(2, "Name required").max(80),
  agencyName: z.string().max(120).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

// ── Link creation ─────────────────────────────────────────────────────────────

export const createLinkSchema = z.object({
  linkType: z.enum(["BANKING_INFO", "SSN_ONLY", "FULL_INTAKE", "ID_UPLOAD"]),
  clientName: z.string().max(120).optional(),
  clientPhone: z.string().max(30).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  expirationHours: z.number().int().min(1).max(168).default(24),
  retentionDays: z.number().int().min(1).max(30).default(7),
  assetIds: z.array(z.string().min(1)).max(10).optional().default([]),
});
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

// ── Secure form submissions ───────────────────────────────────────────────────

const routingNumberRegex = /^\d{9}$/;

// Banking — requires account number confirmation
export const bankingInfoSchema = z
  .object({
    fullName: z.string().min(2, "Full name required").max(120),
    bankName: z.string().max(120).optional(),
    routingNumber: z
      .string()
      .regex(routingNumberRegex, "Routing number must be 9 digits")
      .refine(isValidRoutingNumberChecksum, "Routing number checksum is invalid"),
    accountNumber: z
      .string()
      .min(4, "Account number required")
      .max(34)
      .regex(/^\d+$/, "Account number must contain only digits"),
    confirmAccountNumber: z
      .string()
      .min(4, "Please confirm your account number")
      .max(34)
      .regex(/^\d+$/, "Must contain only digits"),
    preferredDraftDate: z.string().min(1, "Preferred draft date required").max(30),
    consent: z.boolean().refine((v) => v === true, "You must consent to submit"),
  })
  .superRefine((data, ctx) => {
    if (!fieldsMatch(data.accountNumber, data.confirmAccountNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmAccountNumber"],
        message: "Account numbers do not match.",
      });
    }
  });
export type BankingInfoInput = z.infer<typeof bankingInfoSchema>;

// SSN only — no DOB, requires confirmation
export const ssnOnlySchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(80),
    lastName: z.string().min(1, "Last name is required").max(80),
    ssn: z.string().refine(isValidSsnFormat, "SSN must be in format XXX-XX-XXXX"),
    confirmSsn: z
      .string()
      .refine(isValidSsnFormat, "Confirm SSN must be in format XXX-XX-XXXX"),
    consent: z.boolean().refine((v) => v === true, "You must consent to submit"),
  })
  .superRefine((data, ctx) => {
    if (!fieldsMatch(data.ssn, data.confirmSsn, true)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmSsn"],
        message: "SSN values do not match.",
      });
    }
  });
export type SsnOnlyInput = z.infer<typeof ssnOnlySchema>;

// Full intake — includes banking (with confirm) + SSN (no DOB in this version)
export const fullIntakeSchema = z
  .object({
    fullName: z.string().min(2, "Full name required").max(120),
    dateOfBirth: z.string().min(1, "Date of birth required"),
    ssn: z.string().refine(isValidSsnFormat, "SSN must be in format XXX-XX-XXXX"),
    address: z.string().min(5, "Address required").max(300),
    phone: z.string().min(7, "Phone required").max(30),
    email: z.string().email("Valid email required"),
    beneficiaryName: z.string().max(120).optional(),
    beneficiaryRelationship: z.string().max(80).optional(),
    bankName: z.string().max(120).optional(),
    routingNumber: z
      .string()
      .regex(routingNumberRegex, "Routing number must be 9 digits")
      .refine(isValidRoutingNumberChecksum, "Routing number checksum is invalid"),
    accountNumber: z
      .string()
      .min(4, "Account number required")
      .max(34)
      .regex(/^\d+$/, "Account number must contain only digits"),
    confirmAccountNumber: z
      .string()
      .min(4, "Please confirm your account number")
      .max(34)
      .regex(/^\d+$/, "Must contain only digits"),
    preferredDraftDate: z.string().min(1, "Preferred draft date required").max(30),
    consent: z.boolean().refine((v) => v === true, "You must consent to submit"),
  })
  .superRefine((data, ctx) => {
    if (!fieldsMatch(data.accountNumber, data.confirmAccountNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmAccountNumber"],
        message: "Account numbers do not match.",
      });
    }
  });
export type FullIntakeInput = z.infer<typeof fullIntakeSchema>;

// ── Profile update ────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80),
  agencyName: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  licenseNumber: z.string().max(60).optional(),
  licensedStates: z.string().max(200).optional(),
  // Onboarding fields
  industry: z.string().max(80).optional(),
  destinationLabel: z.string().max(120).optional(),
  carriersList: z.string().max(400).optional(),
  notificationEmail: z.string().email().optional().or(z.literal("")),
  // Compliance / trust
  verificationStatus: z.enum(["UNVERIFIED", "LICENSED", "CERTIFIED", "REGULATED"]).optional(),
  dataRetentionDays: z.number().int().refine((v) => [30, 60, 90, -1].includes(v)).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ── Custom Form Builder ────────────────────────────────────────────────────────

export const FIELD_TYPES = [
  "text", "email", "phone", "address", "date",
  "dropdown", "ssn", "routing", "bank_account", "signature",
] as const;

export type FormFieldType = (typeof FIELD_TYPES)[number];

export const SENSITIVE_FIELD_TYPES: FormFieldType[] = ["ssn", "routing", "bank_account"];

export const formFieldSchema = z.object({
  label: z.string().min(1, "Label required").max(120),
  fieldType: z.enum(FIELD_TYPES),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(400).optional(),
  required: z.boolean().default(false),
  encrypted: z.boolean().default(true),
  maskInput: z.boolean().default(false),
  confirmField: z.boolean().default(false),
  dropdownOptions: z.array(z.string().min(1).max(100)).max(30).optional(),
  order: z.number().int().min(0).default(0),
});
export type FormFieldInput = z.infer<typeof formFieldSchema>;

export const createFormSchema = z.object({
  title: z.string().min(1, "Title required").max(120),
  description: z.string().max(500).optional(),
  retentionDays: z.number().int().refine((v) => [30, 60, 90, -1].includes(v)).default(30),
  fields: z.array(formFieldSchema).min(1, "At least one field required"),
});
export type CreateFormInput = z.infer<typeof createFormSchema>;

export const createFormLinkSchema = z.object({
  clientName: z.string().max(120).optional(),
  clientPhone: z.string().max(30).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  expirationHours: z.number().int().min(1).max(168).default(24),
  assetIds: z.array(z.string().min(1)).max(10).optional().default([]),
});
export type CreateFormLinkInput = z.infer<typeof createFormLinkSchema>;
