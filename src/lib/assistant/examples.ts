// The example questions on the assistant page, shown before anything is asked.
export type Example = { title: string; question: string };

// Answerable from the two bundled regulations alone, so they work on a new
// installation.
export const BUNDLED_EXAMPLES: Example[] = [
  {
    title: "Inspect equipment",
    question: "How often does a forklift used around the clock need inspection?",
  },
  {
    title: "Take equipment out of service",
    question:
      "Our forklift's brakes are failing. Can we use it until the mechanic comes?",
  },
  {
    title: "Check a reporting deadline",
    question:
      "Does hospitalization only for observation have to be reported to TOSHA?",
  },
  {
    title: "Understand training",
    question: "I had a near miss on the forklift. Do I need retraining?",
  },
];

// Shown once the organization's own documents are in the Source library. They
// fit a collection like Lipscomb's: an employee handbook, an injury report
// form and a mold procedure.
export const OWN_DOCUMENT_EXAMPLES: Example[] = [
  {
    title: "Report an injury",
    question: "What should I do if I am injured at work?",
  },
  {
    title: "Help an injured visitor",
    question: "A visitor is hurt but not badly. Where do I take them?",
  },
  {
    title: "Report mold",
    question: "How do I report mold, and how fast does Facilities respond?",
  },
  {
    title: "Check a reporting deadline",
    question:
      "Does hospitalization only for observation have to be reported to TOSHA?",
  },
];
