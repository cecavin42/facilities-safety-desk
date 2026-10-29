export const LOCATIONS = [
  "Central storeroom",
  "Loading dock",
  "Maintenance shop",
  "Grounds",
  "Inside a campus building",
  "Roadway or parking",
  "Office",
] as const;

export const SHIFTS = ["Day", "Evening", "Night"] as const;

export const EVENT_TYPES = [
  "Injury",
  "Near miss",
  "Property damage",
  "Unsafe condition",
] as const;

export const SEVERITIES = [
  "None",
  "First aid only",
  "Medical treatment",
  "Days away from work",
  "Hospitalization",
] as const;

export const EQUIPMENT = [
  "Forklift",
  "Pallet jack",
  "Utility vehicle or cart",
  "Ladder",
  "Power tool",
  "Hand tool",
  "None",
] as const;

export const STATUSES = ["Open", "Under review", "Closed"] as const;

export type Location = (typeof LOCATIONS)[number];
export type Shift = (typeof SHIFTS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Status = (typeof STATUSES)[number];

export type IncidentRecord = {
  id: string;
  createdAt: string;
  status: Status;
  eventDate: string;
  eventTime: string;
  location: Location;
  buildingName: string;
  shift: Shift;
  eventType: EventType;
  severity: Severity;
  daysAway: number | null;
  equipment: Equipment;
  description: string;
  immediateAction: string;
  reporterName: string;
  reporterEmail: string;
};

export const FORM_FIELDS = [
  "eventDate",
  "eventTime",
  "location",
  "buildingName",
  "shift",
  "eventType",
  "severity",
  "daysAway",
  "equipment",
  "description",
  "immediateAction",
  "reporterName",
  "reporterEmail",
] as const;

export type FormField = (typeof FORM_FIELDS)[number];
export type ReportInput = Partial<Record<FormField, string>>;

export const FIELD_LABELS: Record<FormField, string> = {
  eventDate: "Date of event",
  eventTime: "Time of event",
  location: "Location",
  buildingName: "Building name",
  shift: "Shift",
  eventType: "Event type",
  severity: "Severity",
  daysAway: "Days away from work",
  equipment: "Equipment involved",
  description: "Description",
  immediateAction: "Immediate action taken",
  reporterName: "Reporter name",
  reporterEmail: "Reporter email",
};
