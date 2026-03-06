import test from "node:test";
import assert from "node:assert/strict";
import { getInitialSendMethod } from "@/lib/request-send";

test("initial send method prefers SMS only when twilio and phone are available", () => {
  assert.equal(
    getInitialSendMethod({
      twilioEnabled: true,
      clientPhone: "+15550000000",
      clientEmail: "client@example.com",
    }),
    "SMS"
  );
});

test("initial send method falls back to email then copy", () => {
  assert.equal(
    getInitialSendMethod({
      twilioEnabled: true,
      clientPhone: "   ",
      clientEmail: "client@example.com",
    }),
    "EMAIL"
  );

  assert.equal(
    getInitialSendMethod({
      twilioEnabled: false,
      clientPhone: null,
      clientEmail: "",
    }),
    "COPY"
  );
});
