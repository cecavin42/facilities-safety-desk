import { database } from "@/lib/database";
import { addRecords, BatchConflict } from "@/lib/db/repository";
import { failure, isObject, readJson, RequestError } from "@/lib/api";
import { FORM_FIELDS, type ReportInput } from "@/lib/options";
import { validateReport } from "@/lib/validation";
import type { NewIncident } from "@/lib/data-types";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!isObject(body) || !Array.isArray(body.records) || body.records.length < 1 || body.records.length > 5000) {
      throw new RequestError("Send 1 to 5,000 records.");
    }
    if (typeof body.requestId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(body.requestId)) {
      throw new RequestError("A valid request ID is required.");
    }
    const records: NewIncident[] = [];
    const rejected: { row: number; reasons: string[] }[] = [];
    body.records.forEach((row, i) => {
      const input: ReportInput = {};
      if (!isObject(row)) { rejected.push({ row: i + 1, reasons: ["Record must be an object."] }); return; }
      for (const field of FORM_FIELDS) {
        const value = row[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== "string" && !(field === "daysAway" && typeof value === "number")) {
          rejected.push({ row: i + 1, reasons: [`${field} must be text.`] }); return;
        }
        input[field] = String(value);
      }
      const result = validateReport(input);
      if (result.ok) records.push(result.record);
      else rejected.push({ row: i + 1, reasons: Object.values(result.errors) });
    });
    // All rows in this confirmed batch are validated before any are written.
    if (rejected.length) return Response.json({ error: "Some records are invalid. Nothing was saved.", rejected }, { status: 400 });
    return Response.json({ records: await addRecords(database(), records, body.requestId) }, { status: 201 });
  } catch (error) {
    if (error instanceof BatchConflict) return failure(new RequestError("This request ID was already used. Reload before submitting different records.", 409));
    return failure(error);
  }
}
