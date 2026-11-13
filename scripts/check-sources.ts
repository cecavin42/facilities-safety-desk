import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { BASE, Client, localSetup } from "./readiness-client";
async function main() {
  const { pool, accounts, admin } = await localSetup();
  const results: string[] = [];
  const created: string[] = [];
  let originalActive: string | undefined;
  try {
    const employee = new Client();
    const ea = accounts.find((a) => a.role === "user")!;
    await employee.login(ea.email, ea.password);
    const nonce = randomUUID().slice(0, 8);
    const query = `Where is the quartz-${nonce} workshop binder stored?`;
    const upload = (text: string, documentId = "") => {
      const f = new FormData();
      for (const [k, v] of Object.entries({
        title: `Synthetic source lifecycle ${nonce}`,
        publisher: "Local test fixture",
        revision: "2026-11-03",
        sourceUrl: "https://example.invalid/synthetic-source",
        scope: "Fictional test only",
        credit: "Original fictional text for local development.",
        documentId,
      }))
        f.set(k, v);
      f.set("file", new Blob([text], { type: "text/plain" }), "synthetic.txt");
      return f;
    };
    const text1 = `This is a fictional local test procedure. The quartz-${nonce} workshop binder is stored in Cabinet Q17. This statement applies only to this synthetic test fixture.`;
    assert.equal(
      (await employee.request("/api/sources/upload", "POST", upload(text1)))
        .status,
      403,
    );
    const draft = await admin.request(
      "/api/sources/upload",
      "POST",
      upload(text1),
    );
    assert.equal(draft.status, 201);
    created.push(draft.data.id);
    const detail = (await admin.request(`/api/sources/${draft.data.id}`)).data;
    assert.equal(detail.state, "draft");
    assert.equal(
      (await employee.request(`/api/sources/${draft.data.id}`)).status,
      404,
    );
    const before = await employee.request("/api/ask", "POST", {
      question: query,
    });
    assert.ok(
      !before.data.evidence.some(
        (e: { documentId: string }) => e.documentId === detail.documentId,
      ),
    );
    results.push(
      "Only admins can upload; draft text is invisible to employees and new answers",
    );
    assert.equal(
      (
        await admin.request(`/api/sources/${draft.data.id}`, "PATCH", {
          state: "active",
          reviewed: true,
        })
      ).status,
      200,
    );
    const active = await employee.request("/api/ask", "POST", {
      question: query,
    });
    assert.ok(
      active.data.evidence.some((e: { text: string }) =>
        e.text.includes("Cabinet Q17"),
      ),
    );
    assert.notEqual(active.data.sourceVersion, before.data.sourceVersion);
    results.push(
      "Activation makes exact text searchable and changes the source snapshot",
    );
    const text2 = text1.replace("Cabinet Q17", "Cabinet Z42");
    const replacement = await admin.request(
      "/api/sources/upload",
      "POST",
      upload(text2, detail.documentId),
    );
    assert.equal(replacement.status, 201);
    created.push(replacement.data.id);
    const stillOld = await employee.request("/api/ask", "POST", {
      question: query,
    });
    assert.ok(
      stillOld.data.evidence.some((e: { text: string }) =>
        e.text.includes("Q17"),
      ),
    );
    await admin.request(`/api/sources/${replacement.data.id}`, "PATCH", {
      state: "active",
      reviewed: true,
    });
    const updated = await employee.request("/api/ask", "POST", {
      question: query,
    });
    assert.ok(
      updated.data.evidence.some((e: { text: string }) =>
        e.text.includes("Z42"),
      ),
    );
    assert.ok(
      !updated.data.evidence.some((e: { text: string }) =>
        e.text.includes("Q17"),
      ),
    );
    assert.equal(
      (await employee.request(`/api/sources/${draft.data.id}`)).status,
      404,
    );
    results.push(
      "Draft replacement does not change answers; activation retires the old version and invalidates cached evidence",
    );
    await admin.request(`/api/sources/${replacement.data.id}`, "PATCH", {
      state: "retired",
      reviewed: true,
    });
    const retired = await employee.request("/api/ask", "POST", {
      question: query,
    });
    assert.ok(
      !retired.data.evidence.some(
        (e: { documentId: string }) => e.documentId === detail.documentId,
      ),
    );
    results.push("Retired versions cannot support new responses");
    const sources = (await admin.request("/api/sources")).data as {
      id: string;
      documentId: string;
      state: string;
    }[];
    originalActive = sources.find(
      (s) => s.documentId === "cfr-1910-178" && s.state === "active",
    )!.id;
    await admin.request(`/api/sources/${originalActive}`, "PATCH", {
      state: "retired",
      reviewed: true,
    });
    const noFederal = await employee.request("/api/ask", "POST", {
      question: "How often does a forklift have to be inspected?",
    });
    assert.ok(
      !noFederal.data.evidence.some(
        (e: { documentId: string }) => e.documentId === "cfr-1910-178",
      ),
    );
    results.push(
      "Retiring a bundled document also disables its static answer-guide citations",
    );
    await admin.request(`/api/sources/${originalActive}`, "PATCH", {
      state: "active",
      reviewed: true,
    });
    originalActive = undefined;
    const pdf = await readFile("tests/fixtures/source-document.pdf");
    const form = upload("placeholder");
    form.set("title", `PDF parser fixture ${nonce}`);
    form.set("publisher", "Team A synthetic parser fixture");
    form.set(
      "credit",
      "Original fictional text for local development. Parser fixture, not activated.",
    );
    form.set(
      "file",
      new Blob([pdf], { type: "application/pdf" }),
      "source-document.pdf",
    );
    const parsed = await admin.request("/api/sources/upload", "POST", form);
    assert.equal(parsed.status, 201);
    created.push(parsed.data.id);
    assert.ok(parsed.data.passageCount >= 3);
    const bad = upload("unused");
    bad.set("file", new Blob(["%PDF-broken"]), "broken.pdf");
    assert.equal(
      (await admin.request("/api/sources/upload", "POST", bad)).status,
      400,
    );
    results.push(
      "Text PDFs extract with page references; malformed PDFs are rejected",
    );
    // The stored original must be the uploaded file, byte for byte. The
    // download is read as bytes here because Client.request decodes text.
    const download = await fetch(`${BASE}/api/sources/${parsed.data.id}/file`, {
      headers: {
        Cookie: [...admin.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
    });
    assert.equal(download.status, 200);
    assert.ok(Buffer.from(await download.arrayBuffer()).equals(pdf));
    const pdfDocumentId = (
      await admin.request(`/api/sources/${parsed.data.id}`)
    ).data.documentId;
    const pdfVersion = (bytes: Uint8Array<ArrayBuffer>) => {
      const f = upload("placeholder", pdfDocumentId);
      f.set(
        "file",
        new Blob([bytes], { type: "application/pdf" }),
        "source-document.pdf",
      );
      return f;
    };
    // Same pages, different bytes: a trailing comment after the end marker.
    const revised = await admin.request(
      "/api/sources/upload",
      "POST",
      pdfVersion(
        new Uint8Array(Buffer.concat([pdf, Buffer.from("\n% revised copy\n")])),
      ),
    );
    assert.equal(revised.status, 201);
    created.push(revised.data.id);
    assert.equal(
      (await admin.request("/api/sources/upload", "POST", pdfVersion(pdf)))
        .status,
      409,
    );
    results.push(
      "Uploaded PDFs keep their original file: the download matches, a changed PDF is accepted as a new version, an identical one is refused",
    );
    await writeFile(
      "test-results/source-lifecycle-checks.json",
      JSON.stringify({ passed: results.length, results }, null, 2),
    );
    console.log(results.map((r) => "PASS " + r).join("\n"));
  } finally {
    for (const id of created)
      await admin.request(`/api/sources/${id}`, "PATCH", {
        state: "retired",
        reviewed: true,
      });
    if (originalActive)
      await admin.request(`/api/sources/${originalActive}`, "PATCH", {
        state: "active",
        reviewed: true,
      });
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Source checks failed");
  process.exitCode = 1;
});
