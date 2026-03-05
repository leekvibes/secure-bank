import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt } from "@/lib/crypto";

test("encryption/decryption roundtrip", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const plaintext = "123-45-6789";
  const ciphertext = encrypt(plaintext);
  const decrypted = decrypt(ciphertext);

  assert.notEqual(ciphertext, plaintext);
  assert.equal(decrypted, plaintext);

  process.env.ENCRYPTION_KEY = originalKey;
});

