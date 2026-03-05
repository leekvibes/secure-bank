import test from "node:test";
import assert from "node:assert/strict";
import { validateDynamicSubmission } from "@/lib/form-submission-validation";

const fields = [
  { id: "ssn", label: "SSN", fieldType: "ssn", required: true, confirmField: true, encrypted: true },
  { id: "routing", label: "Routing", fieldType: "routing", required: true, confirmField: false, encrypted: true },
  { id: "account", label: "Account", fieldType: "bank_account", required: true, confirmField: true, encrypted: true },
  { id: "email", label: "Email", fieldType: "email", required: true, confirmField: false, encrypted: false },
  { id: "phone", label: "Phone", fieldType: "phone", required: true, confirmField: false, encrypted: false },
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
    },
    () => true
  );

  assert.ok(fieldErrors.ssn);
  assert.ok(fieldErrors.account);
  assert.ok(fieldErrors.email);
  assert.ok(fieldErrors.phone);
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
    },
    () => true
  );

  assert.ok(fieldErrors.confirm_ssn);
  assert.ok(fieldErrors.confirm_account);
});
