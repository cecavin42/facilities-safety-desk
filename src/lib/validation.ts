import {
  EQUIPMENT,
  EVENT_TYPES,
  LOCATIONS,
  SEVERITIES,
  SHIFTS,
  type Equipment,
  type EventType,
  type FormField,
  type IncidentRecord,
  type Location,
  type ReportInput,
  type Severity,
  type Shift,
} from "./options";

export type ValidationResult =
  | { ok: true; record: Omit<IncidentRecord, "id" | "createdAt" | "status"> }
  | { ok: false; errors: Partial<Record<FormField, string>> };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function oneOf<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

// `today` is a YYYY-MM-DD string so the same rules give the same answer in tests.
export function validateReport(input: ReportInput, today = isoDate(new Date())): ValidationResult {
  const v = (k: FormField) => (input[k] ?? "").trim();
  const errors: Partial<Record<FormField, string>> = {};

  const eventDate = v("eventDate");
  if (!eventDate) errors.eventDate = "Date of event is required.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || isNaN(Date.parse(eventDate + "T00:00:00Z")) || isoDate(new Date(eventDate + "T00:00:00Z")) !== eventDate)
    errors.eventDate = "Date must be a real date in the format YYYY-MM-DD.";
  else {
    const oneYearAgo = new Date(today + "T00:00:00Z");
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    if (eventDate > today) errors.eventDate = "Date of event cannot be in the future.";
    else if (eventDate < isoDate(oneYearAgo)) errors.eventDate = "Date of event cannot be more than 1 year ago.";
  }

  const eventTime = v("eventTime");
  if (eventTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime))
    errors.eventTime = "Time must use 24-hour HH:MM format, for example 14:30.";

  const location = v("location");
  if (!location) errors.location = "Location is required.";
  else if (!oneOf(LOCATIONS, location)) errors.location = `Location must be one of: ${LOCATIONS.join(", ")}.`;

  const buildingName = v("buildingName");
  if (location === "Inside a campus building") {
    if (!buildingName) errors.buildingName = "Building name is required when the location is inside a campus building.";
    else if (buildingName.length < 2 || buildingName.length > 80) errors.buildingName = "Building name must be 2 to 80 characters.";
  }

  const shift = v("shift");
  if (!shift) errors.shift = "Shift is required.";
  else if (!oneOf(SHIFTS, shift)) errors.shift = `Shift must be one of: ${SHIFTS.join(", ")}.`;

  const eventType = v("eventType");
  if (!eventType) errors.eventType = "Event type is required.";
  else if (!oneOf(EVENT_TYPES, eventType)) errors.eventType = `Event type must be one of: ${EVENT_TYPES.join(", ")}.`;

  const severity = v("severity");
  if (!severity) errors.severity = "Severity is required.";
  else if (!oneOf(SEVERITIES, severity)) errors.severity = `Severity must be one of: ${SEVERITIES.join(", ")}.`;
  else if ((eventType === "Near miss" || eventType === "Unsafe condition") && severity !== "None")
    errors.severity = "Severity must be None for a near miss or unsafe condition.";

  const daysAwayRaw = v("daysAway");
  let daysAway: number | null = null;
  if (severity === "Days away from work") {
    if (!daysAwayRaw) errors.daysAway = "Days away from work is required when severity is Days away from work.";
    else if (!/^\d+$/.test(daysAwayRaw) || +daysAwayRaw < 1 || +daysAwayRaw > 180)
      errors.daysAway = "Days away from work must be a whole number from 1 to 180.";
    else daysAway = +daysAwayRaw;
  }

  const equipment = v("equipment");
  if (!equipment) errors.equipment = "Equipment involved is required.";
  else if (!oneOf(EQUIPMENT, equipment)) errors.equipment = `Equipment must be one of: ${EQUIPMENT.join(", ")}.`;

  const description = v("description");
  if (!description) errors.description = "Description is required.";
  else if (description.length < 20 || description.length > 2000)
    errors.description = `Description must be 20 to 2,000 characters (it is ${description.length}).`;

  const immediateAction = v("immediateAction");
  if (immediateAction.length > 1000) errors.immediateAction = "Immediate action taken must be 1,000 characters or fewer.";

  const reporterName = v("reporterName");
  if (!reporterName) errors.reporterName = "Reporter name is required.";
  else if (reporterName.length < 2 || reporterName.length > 80) errors.reporterName = "Reporter name must be 2 to 80 characters.";

  const reporterEmail = v("reporterEmail");
  if (!reporterEmail) errors.reporterEmail = "Reporter email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) errors.reporterEmail = "Reporter email must be a valid email address.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    record: {
      eventDate,
      eventTime,
      location: location as Location,
      buildingName: location === "Inside a campus building" ? buildingName : "",
      shift: shift as Shift,
      eventType: eventType as EventType,
      severity: severity as Severity,
      daysAway,
      equipment: equipment as Equipment,
      description,
      immediateAction,
      reporterName,
      reporterEmail,
    },
  };
}
