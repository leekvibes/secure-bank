import test from "node:test";
import assert from "node:assert/strict";
import { buildSubmissionsIndex } from "@/lib/submissions-index";

test("submissions index includes id uploads and routes to upload viewer", () => {
  const rows = buildSubmissionsIndex(
    [
      {
        id: "legacy_1",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        revealedAt: null,
        link: { id: "link_1", clientName: "Legacy Client", linkType: "BANKING_INFO" },
      },
    ],
    [
      {
        id: "form_1",
        formId: "form_a",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
        viewedAt: null,
        form: { title: "Intake" },
        formLink: { clientName: "Form Client" },
      },
    ],
    [
      {
        id: "upload_1",
        createdAt: new Date("2026-03-03T00:00:00.000Z"),
        viewedAt: null,
        link: { id: "link_upload", clientName: "ID Client" },
      },
    ]
  );

  assert.equal(rows.length, 3);
  const idRow = rows.find((r) => r.id === "upload_1");
  assert.ok(idRow);
  assert.equal(idRow?.type, "ID_UPLOAD");
  assert.equal(idRow?.href, "/dashboard/uploads/upload_1");
});
