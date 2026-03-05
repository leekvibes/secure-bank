import { z } from "zod";

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  displayName: z.string().min(2, "Name required").max(80),
  agencyName: z.string().max(120).optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

// ── Link creation ─────────────────────────────────────────────────────────────

export const createLinkSchema = z.object({
  linkType: z.enum(["BANKING_INFO", "SSN_DOB", "FULL_INTAKE", "SSN_ONLY"]),
  clientName: z.string().max(120).optional(),
  clientPhone: z.string().max(30).optional(),
  clientEmail: z.string().email().optional().or(z.literal("")),
  expirationHours: z.number().int().min(1).max(168).default(24), // max 7 days
  viewOnce: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(30).default(7),
}).superRefine((data, ctx) => {
  if (data.linkType === "SSN_ONLY" && (!data.clientName || data.clientName.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clientName"],
      message: "Client name is required for SSN links.",
    });
  }
});

export type CreateLinkInput = z.infer<typeof createLinkSchema>;

// ── Secure form submissions ───────────────────────────────────────────────────

const routingNumberRegex = /^\d{9}$/;
const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;

export const bankingInfoSchema = z.object({
  fullName: z.string().min(2, "Full name required").max(120),
  bankName: z.string().max(120).optional(),
  routingNumber: z
    .string()
    .regex(routingNumberRegex, "Routing number must be 9 digits"),
  accountNumber: z
    .string()
    .min(4, "Account number required")
    .max(34)
    .regex(/^\d+$/, "Account number must contain only digits"),
  preferredDraftDate: z
    .string()
    .min(1, "Preferred draft date required")
    .max(30),
  consent: z
    .boolean()
    .refine((v) => v === true, "You must consent to submit"),
});

export type BankingInfoInput = z.infer<typeof bankingInfoSchema>;

export const ssnDobSchema = z.object({
  fullName: z.string().min(2, "Full name required").max(120),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  ssn: z.string().regex(ssnRegex, "SSN must be in format XXX-XX-XXXX or 9 digits"),
  consent: z
    .boolean()
    .refine((v) => v === true, "You must consent to submit"),
});

export type SsnDobInput = z.infer<typeof ssnDobSchema>;

export const ssnOnlySchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(80),
    lastName: z.string().min(1, "Last name is required").max(80),
    ssn: z
      .string()
      .regex(ssnRegex, "SSN must be in format XXX-XX-XXXX or 9 digits"),
    confirmSsn: z
      .string()
      .regex(ssnRegex, "Confirm SSN must be in format XXX-XX-XXXX or 9 digits"),
    consent: z
      .boolean()
      .refine((v) => v === true, "You must consent to submit"),
  })
  .superRefine((data, ctx) => {
    const normalize = (value: string) => value.replace(/\D/g, "");
    if (normalize(data.ssn) !== normalize(data.confirmSsn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmSsn"],
        message: "Confirm SSN must match SSN.",
      });
    }
  });

export type SsnOnlyInput = z.infer<typeof ssnOnlySchema>;

export const fullIntakeSchema = z.object({
  fullName: z.string().min(2, "Full name required").max(120),
  dateOfBirth: z.string().min(1, "Date of birth required"),
  ssn: z.string().regex(ssnRegex, "SSN must be in format XXX-XX-XXXX or 9 digits"),
  address: z.string().min(5, "Address required").max(300),
  phone: z.string().min(7, "Phone required").max(30),
  email: z.string().email("Valid email required"),
  beneficiaryName: z.string().max(120).optional(),
  beneficiaryRelationship: z.string().max(80).optional(),
  bankName: z.string().max(120).optional(),
  routingNumber: z
    .string()
    .regex(routingNumberRegex, "Routing number must be 9 digits"),
  accountNumber: z
    .string()
    .min(4, "Account number required")
    .max(34)
    .regex(/^\d+$/, "Account number must contain only digits"),
  preferredDraftDate: z.string().min(1, "Preferred draft date required").max(30),
  consent: z
    .boolean()
    .refine((v) => v === true, "You must consent to submit"),
});

export type FullIntakeInput = z.infer<typeof fullIntakeSchema>;

// ── Profile update ────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80),
  agencyName: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  licenseNumber: z.string().max(60).optional(),
  licensedStates: z.string().max(200).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
