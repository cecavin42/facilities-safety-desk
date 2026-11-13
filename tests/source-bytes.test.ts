import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extractPages } from "../src/lib/sources";

const fingerprint = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

test("reading a PDF's text leaves the uploaded bytes intact", async () => {
  // createSource fingerprints and stores these same bytes after the text is
  // read, so an emptied array means an empty stored file and one shared
  // fingerprint for every PDF.
  const bytes = new Uint8Array(
    await readFile("tests/fixtures/source-document.pdf"),
  );
  const size = bytes.length;
  const before = fingerprint(bytes);
  const pages = await extractPages(bytes, "application/pdf");
  assert.ok(pages.some((page) => page.text.trim().length > 0));
  assert.equal(bytes.length, size);
  assert.equal(fingerprint(bytes), before);
});

test("reading a text file leaves the uploaded bytes intact", async () => {
  const bytes = new TextEncoder().encode(
    "A fictional test line that is long enough to count as usable text.",
  );
  const before = fingerprint(bytes);
  await extractPages(bytes, "text/plain");
  assert.equal(fingerprint(bytes), before);
});
