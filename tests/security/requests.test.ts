import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { deriveRequestStatus, latestSentAt, listRequestRows } from "@/lib/requests";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("request status derivation covers draft/sent/opened/submitted/expired", () => {
  const now = new Date("2026-03-06T12:00:00.000Z");
  const future = new Date("2026-03-07T12:00:00.000Z");
  const past = new Date("2026-03-05T12:00:00.000Z");

  assert.equal(deriveRequestStatus({ expiresAt: future, now }), "DRAFT");
  assert.equal(
    deriveRequestStatus({ expiresAt: future, sentAt: new Date("2026-03-06T01:00:00.000Z"), now }),
    "SENT"
  );
  assert.equal(
    deriveRequestStatus({
      expiresAt: future,
      sentAt: new Date("2026-03-06T01:00:00.000Z"),
      openedAt: new Date("2026-03-06T02:00:00.000Z"),
      now,
    }),
    "OPENED"
  );
  assert.equal(
    deriveRequestStatus({
      expiresAt: future,
      submittedAt: new Date("2026-03-06T03:00:00.000Z"),
      now,
    }),
    "SUBMITTED"
  );
  assert.equal(deriveRequestStatus({ expiresAt: past, now }), "EXPIRED");
});

test("latestSentAt returns most recent send or null", () => {
  const older = new Date("2026-03-06T01:00:00.000Z");
  const newer = new Date("2026-03-06T02:00:00.000Z");

  assert.equal(latestSentAt(undefined), null);
  assert.equal(latestSentAt([]), null);
  assert.equal(latestSentAt([{ createdAt: older }, { createdAt: newer }])?.toISOString(), newer.toISOString());
});

test("request index includes id uploads and uses latest send timestamp", async () => {
  const user = await db.user.create({
    data: {
      email: uniqueEmail("req"),
      passwordHash: "hash",
      displayName: "Requests User",
      agentSlug: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
  });

  const secureToken = `req-secure-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const secure = await db.secureLink.create({
    data: {
      token: secureToken,
      linkType: "BANKING_INFO",
      clientName: "Secure Client",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      retentionDays: 7,
      agentId: user.id,
      status: "CREATED",
    },
  });

  await db.linkDispatch.create({
    data: {
      linkId: secure.id,
      method: "SMS",
      recipient: "+15550000001",
      message: "first",
      createdAt: new Date(Date.now() - 10_000),
    },
  });
  await db.linkDispatch.create({
    data: {
      linkId: secure.id,
      method: "EMAIL",
      recipient: "client@example.com",
      message: "second",
      createdAt: new Date(Date.now() - 2_000),
    },
  });

  const uploadToken = `req-id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const idLink = await db.secureLink.create({
    data: {
      token: uploadToken,
      linkType: "ID_UPLOAD",
      clientName: "ID Client",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      retentionDays: 7,
      agentId: user.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  await db.idUpload.create({
    data: {
      linkId: idLink.id,
      agentId: user.id,
      frontFilePath: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.enc",
      deleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const expiredToken = `req-exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.secureLink.create({
    data: {
      token: expiredToken,
      linkType: "SSN_ONLY",
      clientName: "Expired Client",
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      retentionDays: 7,
      agentId: user.id,
      status: "CREATED",
    },
  });

  const rows = await listRequestRows(user.id);

  const secureRow = rows.find((row) => row.id === secure.id);
  assert.ok(secureRow);
  assert.equal(secureRow?.status, "SENT");
  assert.equal(secureRow?.latestSendMethod, "EMAIL");
  assert.equal(secureRow?.latestRecipient, "client@example.com");
  assert.ok(secureRow?.sentAt);

  const idRow = rows.find((row) => row.id === idLink.id);
  assert.ok(idRow);
  assert.equal(idRow?.requestType, "ID Upload");
  assert.equal(idRow?.status, "SUBMITTED");
  assert.ok(idRow?.href.startsWith("/dashboard/uploads/"));

  const expiredRow = rows.find((row) => row.clientName === "Expired Client");
  assert.ok(expiredRow);
  assert.equal(expiredRow?.status, "EXPIRED");

  const form = await db.form.create({
    data: {
      agentId: user.id,
      title: "Health Intake",
      status: "ACTIVE",
      retentionDays: 30,
    },
  });
  const formLink = await db.formLink.create({
    data: {
      formId: form.id,
      token: `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clientName: "Form Client",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "CREATED",
    },
  });
  await db.formLinkDispatch.create({
    data: {
      formLinkId: formLink.id,
      method: "EMAIL",
      recipient: "form@example.com",
      message: "Please complete",
    },
  });

  const rowsAfterForm = await listRequestRows(user.id);
  const formRow = rowsAfterForm.find((row) => row.id === formLink.id);
  assert.ok(formRow);
  assert.equal(formRow?.source, "FORM_LINK");
  assert.equal(formRow?.status, "SENT");
});
