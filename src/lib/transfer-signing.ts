import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const SIGN_TTL_SECONDS = 600; // 10 minutes

function getSecret(): string {
  const s = process.env.TRANSFER_SIGNING_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TRANSFER_SIGNING_SECRET is required in production");
    }
    return "dev-transfer-signing-secret-do-not-use-in-prod";
  }
  return s;
}

interface Payload {
  fileId: string;
  transferToken: string;
  action: "preview" | "download";
  exp: number;
  nonce: string;
}

function b64url(buf: Buffer | string): string {
  const s = typeof buf === "string" ? buf : buf.toString("base64");
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sign(payloadJson: string): string {
  return b64url(
    createHmac("sha256", getSecret()).update(payloadJson).digest("base64")
  );
}

export function signTransferAccess(opts: {
  fileId: string;
  transferToken: string;
  action: "preview" | "download";
}): string {
  const payload: Payload = {
    ...opts,
    exp: Math.floor(Date.now() / 1000) + SIGN_TTL_SECONDS,
    nonce: randomBytes(8).toString("hex"),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64url(Buffer.from(payloadJson));
  const sig = sign(payloadJson);
  return `${payloadB64}.${sig}`;
}

export function verifyTransferAccess(token: string): Payload | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx < 0) return null;

    const payloadB64 = token.slice(0, dotIdx);
    const providedSig = token.slice(dotIdx + 1);

    const payloadJson = Buffer.from(
      payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");

    const expectedSig = sign(payloadJson);

    // Constant-time comparison
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;

    const payload: Payload = JSON.parse(payloadJson);
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    if (!payload.fileId || !payload.transferToken || !payload.action) return null;
    if (payload.action !== "preview" && payload.action !== "download") return null;

    return payload;
  } catch {
    return null;
  }
}
