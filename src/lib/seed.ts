import type { Equipment, EventType, IncidentRecord, Location, Severity, Shift, Status } from "./options";
import type { QuestionLogEntry } from "./data-types";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function weighted<T>(r: () => number, items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [item, w] of items) {
    if ((x -= w) < 0) return item;
  }
  return items[items.length - 1][0];
}

const FIRST = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Drew", "Quinn", "Avery", "Reese"];
const LAST = ["Smith", "Johnson", "Lee", "Brown", "Davis", "Garcia", "Miller", "Wilson", "Moore", "Clark", "Hall", "Young"];
const BUILDINGS = ["Hodges Library", "Science Hall", "Student Union", "Ayres Hall", "Recreation Center", "Engineering Annex"];

const DESCRIPTIONS: Record<EventType, string[]> = {
  Injury: [
    "Employee strained lower back while lifting boxes from a pallet onto a shelf.",
    "Worker cut hand on a sharp metal edge while opening a supply crate.",
    "Employee slipped on a wet floor near the dock door and bruised a knee.",
    "Operator's foot was pinched between the pallet jack and a loaded pallet.",
  ],
  "Near miss": [
    "Forklift backing out of an aisle nearly struck a pedestrian who was not visible.",
    "Load shifted on the forks during a turn but did not fall.",
    "Ladder slid on a smooth floor while an employee was stepping down.",
    "Utility cart rolled downhill after the parking brake was not set.",
  ],
  "Property damage": [
    "Forklift mast struck an overhead door frame and dented it.",
    "Pallet jack punctured a drywall corner in the hallway.",
    "Utility cart scraped a parked vehicle in the service lot.",
  ],
  "Unsafe condition": [
    "Blocked emergency exit behind stacked pallets in the storeroom.",
    "Damaged rack upright found in aisle 4; rack still loaded.",
    "Forklift horn not working during the pre-shift check.",
    "Poor lighting at the loading dock ramp after dark.",
  ],
};

const ACTIONS = [
  "Area cordoned off and supervisor notified.",
  "Equipment tagged out of service until repaired.",
  "First aid given on site.",
  "Spill cleaned up and wet-floor sign posted.",
  "",
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function seedRecords(today = new Date()): IncidentRecord[] {
  const r = rng(42);
  const out: IncidentRecord[] = [];
  for (let i = 1; i <= 150; i++) {
    const daysAgo = 1 + Math.floor(r() * 360);
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo));
    const eventType = weighted<EventType>(r, [["Injury", 30], ["Near miss", 40], ["Property damage", 15], ["Unsafe condition", 25]]);
    const location = weighted<Location>(r, [
      ["Central storeroom", 25], ["Loading dock", 30], ["Maintenance shop", 18], ["Grounds", 12],
      ["Inside a campus building", 10], ["Roadway or parking", 8], ["Office", 4],
    ]);
    const equipment = weighted<Equipment>(r, [
      ["Forklift", 35], ["Pallet jack", 18], ["Utility vehicle or cart", 12], ["Ladder", 10],
      ["Power tool", 8], ["Hand tool", 7], ["None", 15],
    ]);
    const severity: Severity =
      eventType === "Injury"
        ? weighted<Severity>(r, [["First aid only", 50], ["Medical treatment", 30], ["Days away from work", 15], ["Hospitalization", 5]])
        : "None";
    const status: Status = daysAgo > 60 ? weighted<Status>(r, [["Closed", 85], ["Under review", 10], ["Open", 5]])
      : weighted<Status>(r, [["Open", 50], ["Under review", 30], ["Closed", 20]]);
    const shift = weighted<Shift>(r, [["Day", 55], ["Evening", 30], ["Night", 15]]);
    const first = FIRST[Math.floor(r() * FIRST.length)];
    const last = LAST[Math.floor(r() * LAST.length)];
    const descs = DESCRIPTIONS[eventType];
    out.push({
      id: `S-${String(i).padStart(4, "0")}`,
      createdAt: isoDate(d),
      status,
      eventDate: isoDate(d),
      eventTime: `${String(6 + Math.floor(r() * 16)).padStart(2, "0")}:${String(Math.floor(r() * 4) * 15).padStart(2, "0")}`,
      location,
      buildingName: location === "Inside a campus building" ? BUILDINGS[Math.floor(r() * BUILDINGS.length)] : "",
      shift,
      eventType,
      severity,
      daysAway: severity === "Days away from work" ? 1 + Math.floor(r() * 20) : null,
      equipment,
      description: descs[Math.floor(r() * descs.length)],
      immediateAction: ACTIONS[Math.floor(r() * ACTIONS.length)],
      reporterName: `${first} ${last}`,
      reporterEmail: `${first}.${last}@example.edu`.toLowerCase(),
    });
  }
  return out.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

const SEED_QUESTIONS: [string, boolean][] = [
  ["How often does a forklift have to be inspected?", true],
  ["Do I need retraining after a near miss?", true],
  ["How fast do we report a hospitalization to TOSHA?", true],
  ["Who do I report a near miss to?", true],
  ["Can I report a hazard confidentially?", true],
  ["How often are forklift operators evaluated?", true],
  ["Can I ride on the forks?", true],
  ["How much do forklift operators get paid?", false],
  ["Should I take ibuprofen for back pain?", false],
  ["What is the parking permit price?", false],
  ["When is the holiday party?", false],
  ["How do I request vacation days?", false],
];

export function seedQuestions(today = new Date()): QuestionLogEntry[] {
  const r = rng(7);
  const out: QuestionLogEntry[] = [];
  for (let i = 0; i < 80; i++) {
    const daysAgo = Math.floor(r() * 84);
    const d = new Date(today.getTime() - daysAgo * 86400000);
    const [question, answered] = SEED_QUESTIONS[Math.floor(r() * SEED_QUESTIONS.length)];
    out.push({ question, answered, askedAt: d.toISOString() });
  }
  return out;
}
