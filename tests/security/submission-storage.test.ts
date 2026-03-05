import test from "node:test";
import assert from "node:assert/strict";
import { buildEncryptedSubmissionData } from "@/lib/submission-storage";
import { decryptFields } from "@/lib/crypto";

test("submission storage encrypts sensitive fields and strips confirmation fields", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const payload = buildEncryptedSubmissionData({
    fullName: "Jane Client",
    ssn: "123-45-6789",
    confirmSsn: "123-45-6789",
    routingNumber: "021000021",
    accountNumber: "123456789",
    confirmAccountNumber: "123456789",
    consent: true,
  });

  const encrypted = JSON.parse(payload) as Record<string, string>;
  assert.ok(encrypted.ssn);
  assert.ok(encrypted.routingNumber);
  assert.ok(encrypted.accountNumber);
  assert.equal("confirmSsn" in encrypted, false);
  assert.equal("confirmAccountNumber" in encrypted, false);
  assert.equal("consent" in encrypted, false);

  const decrypted = decryptFields(encrypted);
  assert.equal(decrypted.ssn, "123-45-6789");
  assert.equal(decrypted.routingNumber, "021000021");
  assert.equal(decrypted.accountNumber, "123456789");

  process.env.ENCRYPTION_KEY = originalKey;
});

