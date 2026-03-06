import test from "node:test";
import assert from "node:assert/strict";
import { validateDynamicSubmission } from "@/lib/form-submission-validation";
import { bankingInfoSchema, fullIntakeSchema } from "@/lib/schemas";

const fields = [
  { id: "ssn", label: "SSN", fieldType: "ssn", required: true, confirmField: true, encrypted: true },
  { id: "routing", label: "Routing", fieldType: "routing", required: true, confirmField: false, encrypted: true },
  { id: "account", label: "Account", fieldType: "bank_account", required: true, confirmField: true, encrypted: true },
  { id: "email", label: "Email", fieldType: "email", required: true, confirmField: false, encrypted: false },
  { id: "phone", label: "Phone", fieldType: "phone", required: true, confirmField: false, encrypted: false },
  { id: "state", label: "State", fieldType: "dropdown", required: true, confirmField: false, encrypted: false, dropdownOptions: ["CA", "NY"] },
  { id: "effectiveDate", label: "Effective Date", fieldType: "date", required: true, confirmField: false, encrypted: false },
];

test("dynamic submission validation rejects malformed sensitive fields", () => {
  const { fieldErrors } = validateDynamicSubmission(
    fields,
    {
      ssn: "1234",
      confirm_ssn: "1234",
      routing: "123456780",
      account: "12a",
      confirm_account: "12a",
      email: "not-an-email",
      phone: "abc",
      state: "TX",
      effectiveDate: "2026-99-99",
    },
    () => true
  );

  assert.ok(fieldErrors.ssn);
  assert.ok(fieldErrors.account);
  assert.ok(fieldErrors.email);
  assert.ok(fieldErrors.phone);
  assert.ok(fieldErrors.state);
  assert.ok(fieldErrors.effectiveDate);
});

test("dynamic submission validation enforces confirmation matching", () => {
  const { fieldErrors } = validateDynamicSubmission(
    fields,
    {
      ssn: "123-45-6789",
      confirm_ssn: "123-45-6790",
      routing: "021000021",
      account: "12345678",
      confirm_account: "99999999",
      email: "client@example.com",
      phone: "+1 555 000 0000",
      state: "CA",
      effectiveDate: "2026-01-31",
    },
    () => true
  );

  assert.ok(fieldErrors.confirm_ssn);
  assert.ok(fieldErrors.confirm_account);
});

test("banking schema accepts optional middle initial and rejects invalid values", () => {
  const ok = bankingInfoSchema.safeParse({
    fullName: "Taylor Client",
    middleInitial: "Q",
    bankName: "Chase",
    routingNumber: "021000021",
    accountNumber: "12345678",
    confirmAccountNumber: "12345678",
    preferredDraftDate: "15th",
    consent: true,
  });
  assert.equal(ok.success, true);

  const bad = bankingInfoSchema.safeParse({
    fullName: "Taylor Client",
    middleInitial: "QQ",
    bankName: "Chase",
    routingNumber: "021000021",
    accountNumber: "12345678",
    confirmAccountNumber: "12345678",
    preferredDraftDate: "15th",
    consent: true,
  });
  assert.equal(bad.success, false);
});

test("full intake date of birth must be valid and not in the future", () => {
  const invalidDate = fullIntakeSchema.safeParse({
    fullName: "Taylor Client",
    dateOfBirth: "2026-99-10",
    ssn: "123-45-6789",
    address: "123 Main St",
    phone: "(555) 000-0000",
    email: "client@example.com",
    bankName: "Chase",
    routingNumber: "021000021",
    accountNumber: "12345678",
    confirmAccountNumber: "12345678",
    preferredDraftDate: "15th",
    consent: true,
  });
  assert.equal(invalidDate.success, false);

  const futureDate = fullIntakeSchema.safeParse({
    fullName: "Taylor Client",
    dateOfBirth: "2099-01-01",
    ssn: "123-45-6789",
    address: "123 Main St",
    phone: "(555) 000-0000",
    email: "client@example.com",
    bankName: "Chase",
    routingNumber: "021000021",
    accountNumber: "12345678",
    confirmAccountNumber: "12345678",
    preferredDraftDate: "15th",
    consent: true,
  });
  assert.equal(futureDate.success, false);
});
