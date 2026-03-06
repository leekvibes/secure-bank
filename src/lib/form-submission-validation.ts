import {
  fieldsMatch,
  isValidBankAccountNumber,
  isValidEmailAddress,
  isValidIsoDateString,
  isValidPhoneNumber,
  isValidRoutingNumberChecksum,
  isValidSsnFormat,
  normalizeDigits,
} from "@/lib/validation";

export type DynamicField = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  confirmField: boolean;
  encrypted: boolean;
  dropdownOptions?: string | string[] | null;
};

export type ValidatedFormValue = {
  fieldId: string;
  fieldLabel: string;
  value: string;
  isEncrypted: boolean;
};

export function validateDynamicSubmission(
  fields: DynamicField[],
  body: Record<string, unknown>,
  isSensitiveFieldType: (fieldType: string) => boolean
): { values: ValidatedFormValue[]; fieldErrors: Record<string, string> } {
  const values: ValidatedFormValue[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const field of fields) {
    const rawValue = body[field.id] ?? "";
    const value = String(rawValue).trim();

    if (field.required && !value) {
      fieldErrors[field.id] = `${field.label} is required.`;
      continue;
    }
    if (!value) continue;

    if (field.fieldType === "ssn" && !isValidSsnFormat(value)) {
      fieldErrors[field.id] = `${field.label} must be in format XXX-XX-XXXX.`;
      continue;
    }
    if (field.fieldType === "routing" && !isValidRoutingNumberChecksum(value)) {
      fieldErrors[field.id] = `${field.label} is invalid.`;
      continue;
    }
    if (field.fieldType === "bank_account" && !isValidBankAccountNumber(value)) {
      fieldErrors[field.id] = `${field.label} must be 4-34 digits.`;
      continue;
    }
    if (field.fieldType === "phone" && !isValidPhoneNumber(value)) {
      fieldErrors[field.id] = `${field.label} is invalid.`;
      continue;
    }
    if (field.fieldType === "email" && !isValidEmailAddress(value)) {
      fieldErrors[field.id] = `${field.label} is invalid.`;
      continue;
    }
    if (field.fieldType === "date" && !isValidIsoDateString(value)) {
      fieldErrors[field.id] = `${field.label} must be a valid date.`;
      continue;
    }
    if (field.fieldType === "dropdown") {
      const options = Array.isArray(field.dropdownOptions)
        ? field.dropdownOptions
        : typeof field.dropdownOptions === "string" && field.dropdownOptions.trim().startsWith("[")
        ? (() => {
            try {
              const parsed = JSON.parse(field.dropdownOptions);
              return Array.isArray(parsed) ? parsed.map((opt) => String(opt)) : [];
            } catch {
              return [];
            }
          })()
        : [];
      if (options.length > 0 && !options.includes(value)) {
        fieldErrors[field.id] = `${field.label} selection is invalid.`;
        continue;
      }
    }

    if (field.confirmField) {
      const confirmValue = String(body[`confirm_${field.id}`] ?? "").trim();
      const digitsOnly =
        field.fieldType === "ssn" ||
        field.fieldType === "routing" ||
        field.fieldType === "bank_account";
      const a = digitsOnly ? normalizeDigits(value) : value;
      const b = digitsOnly ? normalizeDigits(confirmValue) : confirmValue;
      if (!fieldsMatch(a, b)) {
        fieldErrors[`confirm_${field.id}`] = `${field.label} values do not match.`;
      }
    }

    const shouldEncrypt = isSensitiveFieldType(field.fieldType) || field.encrypted;
    values.push({
      fieldId: field.id,
      fieldLabel: field.label,
      value,
      isEncrypted: shouldEncrypt,
    });
  }

  return { values, fieldErrors };
}
