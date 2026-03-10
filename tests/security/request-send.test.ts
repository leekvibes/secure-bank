import test from "node:test";
import assert from "node:assert/strict";
import { getInitialSendMethod } from "@/lib/request-send";

test("initial send method prefers email when client email is available", () => {
  assert.equal(
    getInitialSendMethod({
      clientEmail: "client@example.com",
    }),
    "EMAIL"
  );
});

test("initial send method falls back to copy when email is missing", () => {
  assert.equal(
    getInitialSendMethod({
      clientEmail: "client@example.com",
    }),
    "EMAIL"
  );

  assert.equal(
    getInitialSendMethod({
      clientEmail: "",
    }),
    "COPY"
  );
});
