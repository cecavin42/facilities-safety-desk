import { FORM_FIELDS, type ReportInput } from "./options";
import { validateReport } from "./validation";
import { HttpError } from "./server-access";
export function recordRequest(body: Record<string, unknown>, maxRows: number) {
  if (
    typeof body.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.requestId,
    )
  )
    throw new HttpError("A valid request identifier is required.");
  if (
    !Array.isArray(body.records) ||
    body.records.length < 1 ||
    body.records.length > maxRows
  )
    throw new HttpError(`Send between 1 and ${maxRows} valid reports.`);
  const records = body.records.map((raw, index) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.keys(raw).some(
        (key) => !FORM_FIELDS.includes(key as (typeof FORM_FIELDS)[number]),
      )
    )
      throw new HttpError(`Report ${index + 1} contains unsupported fields.`);
    const input: ReportInput = {};
    for (const key of FORM_FIELDS) {
      const value = raw[key];
      if (
        value != null &&
        typeof value !== "string" &&
        !(key === "daysAway" && typeof value === "number")
      )
        throw new HttpError(`Invalid field in report ${index + 1}.`);
      input[key] = value == null ? "" : String(value);
    }
    const result = validateReport(input);
    if (!result.ok)
      throw new HttpError(
        `Report ${index + 1}: ${Object.values(result.errors).join(" ")}`,
      );
    return result.record;
  });
  return { records, requestId: body.requestId };
}
