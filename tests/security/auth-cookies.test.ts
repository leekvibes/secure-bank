import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextAuthCookieOptions,
  getSameSitePolicy,
  getSessionCookieName,
  useSecureCookies,
} from "@/lib/auth/options";

test("auth cookies use secure+none on https NEXTAUTH_URL", () => {
  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://secure.example.com";
  try {
    assert.equal(useSecureCookies(), true);
    assert.equal(getSameSitePolicy(), "none");
    assert.equal(getSessionCookieName(), "__Secure-next-auth.session-token");
    const opts = getNextAuthCookieOptions();
    assert.equal(opts.secure, true);
    assert.equal(opts.sameSite, "none");
  } finally {
    process.env.NEXTAUTH_URL = original;
  }
});

test("auth cookies use lax+non-secure on local http NEXTAUTH_URL", () => {
  const original = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost:3003";
  try {
    assert.equal(useSecureCookies(), false);
    assert.equal(getSameSitePolicy(), "lax");
    assert.equal(getSessionCookieName(), "next-auth.session-token");
    const opts = getNextAuthCookieOptions();
    assert.equal(opts.secure, false);
    assert.equal(opts.sameSite, "lax");
  } finally {
    process.env.NEXTAUTH_URL = original;
  }
});
