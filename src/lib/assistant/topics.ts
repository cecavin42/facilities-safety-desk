import source from "@/data/documents.json";

export type Topic = {
  id: string;
  title: string;
  scope: string;
  match: RegExp;
  context?: RegExp;
  summary: string;
  evidence: string[];
  followUp?: string;
};
export const TOPICS: Topic[] = [
  {
    id: "inspection",
    title: "Inspection frequency",
    scope: "Federal forklift standard",
    match:
      /inspect|pre.?use|each shift|every shift|round.the.clock|check.*(?:forklift|truck)|(?:forklift|truck).*check/i,
    context: /forklift|truck|pre.?use/i,
    summary:
      "Examine the truck before placing it in service, at least daily. For round-the-clock use, examine it after each shift. Report and correct defects immediately.",
    evidence: ["inspection-complete"],
    followUp: "What should happen if a forklift is defective?",
  },
  {
    id: "refresher",
    title: "Refresher training and evaluation",
    scope: "Federal forklift standard",
    match:
      /retrain|refresh|reevaluat|re.evaluat|three years|3 years|near.?miss|close call|different type of truck/i,
    context: /forklift|truck|operat|train|evaluat|certif/i,
    summary:
      "A forklift accident or near miss is a trigger for refresher training in relevant topics. Unsafe operation, an unsafe evaluation, a different truck type, or changed workplace conditions can also trigger it. Operator performance must be evaluated at least every three years; that interval does not replace event-triggered refresher training.",
    evidence: ["cfr-1910-178-53", "cfr-1910-178-54"],
    followUp: "What belongs in the forklift training certification record?",
  },
  {
    id: "training",
    title: "Operating during training",
    scope: "Federal forklift standard",
    match:
      /before.*train|without.*train|not.*train|untrained|trainee|learn.*driv|finish.*train|train.*finish/i,
    context: /forklift|truck|industrial truck/i,
    summary:
      "Operators must complete the required training before normal operation. The training exception allows trainees to operate only under qualified direct supervision and where doing so does not endanger the trainee or other employees.",
    evidence: ["cfr-1910-178-43", "cfr-1910-178-44"],
  },
  {
    id: "training-record",
    title: "Training certification",
    scope: "Federal forklift standard",
    match:
      /(?:train|certif|evaluat).*(?:record|document|include|contain)|(?:record|document).*(?:train|certif|evaluat)/i,
    summary:
      "Certification includes the operator's name, date of the training, date of the evaluation, and identity of the person or people performing the training or evaluation.",
    evidence: ["cfr-1910-178-56"],
  },
  {
    id: "defect",
    title: "Unsafe or defective equipment",
    scope: "Federal forklift standard",
    match:
      /defect|bad brake|brake.*(?:bad|fail|broken|work)|broken|malfunction|leak|unsafe.*(?:truck|forklift)|(?:truck|forklift).*unsafe|need.*repair/i,
    context: /forklift|truck/i,
    summary:
      "Take a truck that needs repair, is defective, or is unsafe out of service until it has been restored to safe operating condition.",
    evidence: ["cfr-1910-178-74"],
  },
  {
    id: "hazard-report",
    title: "Reporting a hazard or near miss",
    scope: "UT Knoxville procedure — classroom reference",
    match:
      /(?:who|where|how|should|need|must|do).*(?:report|tell|notify)|(?:report|tell|notify).*(?:who|where|near.?miss|close call|hazard|concern)|close call/i,
    context: /near.?miss|close call|hazard|concern|supervisor/i,
    summary:
      "UT's procedure says to report safety hazards to the immediate supervisor as soon as possible. If the matter cannot be adequately addressed, contact EHS or Risk Management. Near misses follow the same reporting process.",
    evidence: ["ut-saad021-k-2", "ut-saad021-k-3"],
    followUp: "Can a safety concern be reported confidentially?",
  },
  {
    id: "retaliation",
    title: "Protection from retaliation",
    scope: "UT Knoxville procedure — classroom reference",
    match: /retaliat|trouble|punish|disciplin|fired|lose my job/i,
    context: /report|hazard|concern|safety|near.?miss/i,
    summary:
      "UT's procedure states that employees are free from retaliation or disciplinary action for reporting safety concerns. This states the policy; it cannot predict what will happen in an individual case.",
    evidence: ["ut-saad021-k-1"],
  },
  {
    id: "confidential",
    title: "Confidential reporting",
    scope: "UT Knoxville procedure — classroom reference",
    match:
      /confidenti|anonym|identity|name.*(?:secret|hidden)|(?:secret|hidden).*name/i,
    context: /report|hazard|complaint|safety|concern/i,
    summary:
      "UT's procedure allows concerns to be reported confidentially when that is indicated. It promises every effort to protect identity, not an absolute guarantee of anonymity.",
    evidence: ["ut-saad021-k-3"],
  },
  {
    id: "injury-report",
    title: "Reporting an employee accident",
    scope: "UT Knoxville procedure — classroom reference",
    match:
      /(?:report|tell|notify).*(?:injur|accident|hurt)|(?:injur|accident|hurt).*(?:report|tell|notify)/i,
    summary:
      "UT's procedure encourages employees to report on-the-job accidents to their immediate supervisor as soon as possible, whether or not medical treatment is necessary. This campus report is separate from an employer's regulatory reporting duty.",
    evidence: ["ut-saad022-k-2"],
  },
  {
    id: "hospital",
    title: "Hospitalization reporting",
    scope: "Tennessee employer reporting rule",
    match: /hospital|admit|admission|amputat|loss of an eye|lost.*eye/i,
    summary:
      "The Tennessee rule requires reporting within 24 hours after a work-related in-patient hospitalization, amputation, or loss of an eye. In-patient hospitalization means formal admission for care or treatment; observation or diagnostic testing alone is excluded. For this reporting duty, the event must occur within 24 hours of the work-related incident. Delayed knowledge has separate timing provisions. Check all conditions, not just the deadline.",
    evidence: [
      "tn-0800-01-03-05-1",
      "tn-0800-01-03-05-5",
      "tn-0800-01-03-05-6",
      "tn-0800-01-03-05-7",
    ],
    followUp:
      "Does hospitalization only for observation have to be reported to TOSHA?",
  },
  {
    id: "fatality",
    title: "Fatality reporting",
    scope: "Tennessee employer reporting rule",
    match: /fatal|death|died|dead|killed/i,
    context: /report|work|employee|tosha|worker/i,
    summary:
      "The Tennessee rule gives an eight-hour reporting period for a work-related fatality. It applies when the death occurs within thirty days of the work-related incident. Delayed knowledge has separate timing provisions; this is not a determination about an individual incident.",
    evidence: [
      "tn-0800-01-03-05-1",
      "tn-0800-01-03-05-5",
      "tn-0800-01-03-05-6",
      "tn-0800-01-03-05-7",
    ],
  },
  {
    id: "road-exception",
    title: "Public-road exception",
    scope: "Tennessee employer reporting rule",
    match:
      /public (?:street|road|highway)|construction.*zone|motor vehicle accident/i,
    summary:
      "The rule distinguishes a motor-vehicle accident in a construction work zone from one on a public street or highway outside a construction work zone. The latter has a TOSHA reporting exception; recordkeeping duties may still apply.",
    evidence: ["tn-0800-01-03-05-3", "tn-0800-01-03-05-4"],
  },
  {
    id: "retention",
    title: "Keeping incident and hazard records",
    scope: "UT Knoxville procedures — classroom reference",
    match:
      /(?:keep|retain|retention|long|years).*(?:record|report|incident|hazard)|(?:record|report).*(?:keep|retain|retention|long|years)/i,
    context: /incident|hazard|accident|investigat|claim/i,
    summary:
      "UT's incident procedure requires accident, claim, incident and investigation records for at least five years. Records expected to involve litigation or take years to settle must be kept more than five years; the procedure does not state one fixed longer duration. The separate hazard-reporting procedure requires its associated records for at least three years. These are different record categories.",
    evidence: ["ut-saad022-k-6", "ut-saad021-k-4"],
  },
  {
    id: "parking",
    title: "Leaving a forklift unattended",
    scope: "Federal forklift standard",
    match: /unattended|park|leave.*(?:forklift|truck)|25 (?:feet|ft)/i,
    context: /forklift|truck/i,
    summary:
      "When unattended, lower the load-engaging means, neutralize controls, shut off power, and set brakes; block wheels on an incline. Unattended includes being at least 25 feet away while still in view, or leaving the truck out of view. Different instructions apply when dismounted within 25 feet and still in view.",
    evidence: ["cfr-1910-178-60", "cfr-1910-178-61"],
  },
];

// Keep the original supplied corpus unchanged. This additive correction restores a
// missing continuation verified against OSHA's official text on 2026-11-03.
const supplement = {
  id: "inspection-complete",
  docId: "cfr-1910-178",
  label: "1910.178(q)(7)",
  text: "Industrial trucks shall be examined before being placed in service, and shall not be placed in service if the examination shows any condition adversely affecting the safety of the vehicle. Such examination shall be made at least daily. Where industrial trucks are used on a round-the-clock basis, they shall be examined after each shift. Defects when found shall be immediately reported and corrected.",
};
export const PASSAGES = [...source.passages, supplement];
export const DOCUMENTS = source.documents.map((d) => ({
  ...d,
  dated:
    d.id === "cfr-1910-178"
      ? "Bundled classroom snapshot; inspection continuation checked 2026-11-03"
      : d.id === "tn-0800-01-03-05"
        ? "Bundled Tennessee rule snapshot — not a live legal update"
        : d.dated,
}));
export const LABELS: Record<string, string> = {
  "cfr-1910-178-54": "1910.178(l)(4)(ii)(D)-(E); (l)(4)(iii)",
  "cfr-1910-178-60": "1910.178(m)(4)-(5)(i)",
  "cfr-1910-178-74": "1910.178(p)(1)-(2)",
};

export function matchTopics(question: string) {
  return TOPICS.filter(
    (t) =>
      t.match.test(question) &&
      (!t.context || t.context.test(question)) &&
      !(
        t.id === "training-record" &&
        /how long|retention|retain|years|keep/i.test(question)
      ),
  ).map((t) => t.id);
}
