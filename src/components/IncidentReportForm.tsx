"use client";

import Link from "next/link";
import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type AriaAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  EQUIPMENT,
  EVENT_TYPES,
  FIELD_LABELS,
  FORM_FIELDS,
  LOCATIONS,
  SEVERITIES,
  SHIFTS,
  type FormField,
  type IncidentRecord,
  type ReportInput,
} from "@/lib/options";
import { validateReport } from "@/lib/validation";

type NewReport = Omit<IncidentRecord, "id" | "createdAt" | "status">;
type Errors = Partial<Record<FormField, string>>;
type Props = {
  ready: boolean;
  onSave: (record: NewReport, requestId: string) => Promise<string>;
  storageDescription: string;
  loadError?: string | null;
  onRetry?: () => void;
};

const control =
  "mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 aria-invalid:border-red-600 aria-invalid:bg-red-50/30 disabled:bg-slate-100";
const action =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50";

function Field({
  name,
  required,
  hint,
  error,
  children,
}: {
  name: FormField;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactElement<AriaAttributes>;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={`f-${name}`}
        className="block text-sm font-semibold text-slate-800"
      >
        {FIELD_LABELS[name]}{" "}
        {required ? (
          <span aria-hidden="true" className="text-teal-800">
            *
          </span>
        ) : (
          <span className="font-normal text-slate-500">(optional)</span>
        )}
      </label>
      {cloneElement(children, {
        "aria-invalid": !!error,
        "aria-required": !!required,
        "aria-describedby": error
          ? `e-${name}`
          : hint
            ? `h-${name}`
            : undefined,
      })}
      {error ? (
        <p id={`e-${name}`} className="mt-2 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`h-${name}`} className="mt-2 text-sm leading-5 text-slate-600">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function Section({
  id,
  number,
  title,
  description,
  disabled,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      id={id}
      disabled={disabled}
      className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <legend className="float-left mb-2 flex w-full items-center gap-3 text-lg font-semibold text-slate-900">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm text-teal-800 ring-1 ring-teal-100"
        >
          {number}
        </span>
        {title}
      </legend>
      <p className="clear-both mb-6 text-sm leading-6 text-slate-600">
        {description}
      </p>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export default function IncidentReportForm({
  ready,
  onSave,
  storageDescription,
  loadError,
  onRetry,
}: Props) {
  const [values, setValues] = useState<ReportInput>({});
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; report: NewReport } | null>(
    null,
  );
  const [draftNotice, setDraftNotice] = useState(
    "Your unfinished report can be kept in this tab while you move around the app.",
  );
  const submitting = useRef(false);
  const requestId = useRef<string | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const nearMiss =
    values.eventType === "Near miss" || values.eventType === "Unsafe condition";
  const invalidFields = FORM_FIELDS.filter((name) => errors[name]);

  useEffect(() => {
    if (saved) successHeading.current?.focus();
  }, [saved]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("fsa.report-draft.v1");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (
        !draft ||
        typeof draft !== "object" ||
        Array.isArray(draft) ||
        Object.entries(draft).some(
          ([k, v]) =>
            !FORM_FIELDS.includes(k as FormField) ||
            typeof v !== "string" ||
            v.length > 2000,
        )
      )
        throw new Error("Invalid draft");

      setValues(draft);
      setDraftNotice("Unfinished report restored from this tab.");
    } catch {
      setDraftNotice(
        "The saved draft could not be read. Keep this page open while completing your report.",
      );
    }
  }, []);

  const change =
    (name: FormField) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      requestId.current = null;
      const value = event.target.value;
      const next = {
        ...values,
        [name]: value,
        ...(name === "eventType" &&
        ["Near miss", "Unsafe condition"].includes(value)
          ? { severity: "None" }
          : {}),
      };
      setValues(next);
      try {
        sessionStorage.setItem("fsa.report-draft.v1", JSON.stringify(next));
        setDraftNotice(
          "Draft kept in this tab. It has not been added to the register.",
        );
      } catch {
        setDraftNotice(
          "This tab could not keep a draft. Stay on this page until you save the report.",
        );
      }
      // Retire corrected errors, including ones affected by another field, without
      // adding new errors before the user next attempts to save.
      const checked = validateReport(next);
      setErrors((old) =>
        Object.fromEntries(
          Object.keys(old).flatMap((key) => {
            const field = key as FormField;
            return !checked.ok && checked.errors[field]
              ? [[field, checked.errors[field]]]
              : [];
          }),
        ),
      );
    };

  function focusField(name: FormField) {
    document.getElementById(`f-${name}`)?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    const checked = validateReport(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setSaveError(null);
      const first = FORM_FIELDS.find((name) => checked.errors[name]);
      if (first) requestAnimationFrame(() => focusField(first));
      return;
    }
    submitting.current = true;
    setSaving(true);
    setErrors({});
    setSaveError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const id = await onSave(checked.record, requestId.current);
      if (!id)
        throw new Error(
          "The save was not confirmed. Your entries are still here; please try again.",
        );
      setSaved({ id, report: checked.record });
      setDraftNotice("A new draft will be kept in this tab as you type.");
      setValues({});
      try {
        sessionStorage.removeItem("fsa.report-draft.v1");
      } catch {
        /* The confirmed record remains saved. */
      }
      requestId.current = null;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save your report. Your entries are still here; please try again.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const select = (name: FormField, options: readonly string[]) => (
    <select
      id={`f-${name}`}
      className={control}
      value={values[name] ?? ""}
      onChange={change(name)}
    >
      <option value="">Choose an option</option>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );

  if (saved)
    return (
      <section
        className="mx-auto max-w-2xl rounded-2xl border border-teal-200 bg-white p-6 shadow-sm sm:p-10"
        aria-labelledby="saved-heading"
      >
        <div
          aria-hidden="true"
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl text-teal-800"
        >
          ✓
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
          Report recorded
        </p>
        <h1
          id="saved-heading"
          ref={successHeading}
          tabIndex={-1}
          className="mt-2 text-3xl font-bold tracking-tight outline-none"
        >
          Your report is saved
        </h1>
        <p className="mt-3 text-slate-600">
          Reference{" "}
          <strong className="font-mono text-slate-900">{saved.id}</strong> ·
          Status: Open
        </p>
        <dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Event</dt>
            <dd className="mt-1 font-semibold">{saved.report.eventType}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Date</dt>
            <dd className="mt-1 font-semibold">{saved.report.eventDate}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Location</dt>
            <dd className="mt-1 font-semibold">{saved.report.location}</dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-6 text-slate-600">
          {storageDescription}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/records"
            className={`${action} bg-teal-700 text-white hover:bg-teal-800`}
          >
            View records
          </Link>
          <button
            type="button"
            className={`${action} border border-slate-300 text-slate-800 hover:bg-slate-50`}
            onClick={() => {
              setSaved(null);
              requestAnimationFrame(() => focusField("eventDate"));
            }}
          >
            Create another report
          </button>
        </div>
      </section>
    );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">
          Incident reporting
        </p>
        <h1
          id="report-heading"
          className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
        >
          Report an incident or near miss
        </h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          Record what happened, where and when. Fields marked{" "}
          <span className="font-semibold text-teal-800">*</span> are required.
        </p>
        <nav
          aria-label="Report sections"
          className="flex flex-wrap gap-2 pt-1 text-sm"
        >
          {[
            ["when-where", "1 · When & where", "eventDate"],
            ["event-details", "2 · Event", "eventType"],
            ["reporter", "3 · Reporter", "reporterName"],
          ].map(([id, label, field]) => (
            <a
              key={id}
              href={`#f-${field}`}
              onClick={(event) => {
                event.preventDefault();
                focusField(field as FormField);
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700 hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
        <p role="status" className="text-xs leading-6 text-slate-600">
          {draftNotice}
        </p>
        {Object.values(values).some(Boolean) && (
          <button
            type="button"
            className="min-h-11 text-xs font-semibold text-teal-800 underline"
            disabled={saving}
            onClick={() => {
              try {
                sessionStorage.removeItem("fsa.report-draft.v1");
                setValues({});
                setErrors({});
                setSaveError(null);
                setDraftNotice("Draft cleared from this tab.");
              } catch {
                setDraftNotice(
                  "The draft could not be cleared. Your entries are still here.",
                );
              }
            }}
          >
            Clear draft
          </button>
        )}
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          {loadError}{" "}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 font-semibold underline"
            >
              Retry loading
            </button>
          )}
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          <strong>Report not saved.</strong> {saveError}
        </div>
      )}
      {!!invalidFields.length && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-950"
        >
          <p className="font-semibold">
            Please check {invalidFields.length}{" "}
            {invalidFields.length === 1 ? "field" : "fields"} before saving.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {invalidFields.map((name) => (
              <li key={name}>
                <a
                  href={`#f-${name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(name);
                  }}
                  className="underline decoration-red-300 underline-offset-2 focus-visible:outline-2 focus-visible:outline-red-800"
                >
                  {FIELD_LABELS[name]}: {errors[name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <form
          onSubmit={submit}
          noValidate
          aria-labelledby="report-heading"
          aria-busy={saving}
          className="min-w-0 space-y-5"
        >
          <Section
            id="when-where"
            number="1"
            title="When and where"
            description="Record the event date and the area where it happened."
            disabled={saving}
          >
            <Field
              name="eventDate"
              required
              hint="Today or a past date within the last year."
              error={errors.eventDate}
            >
              <input
                id="f-eventDate"
                type="date"
                className={control}
                value={values.eventDate ?? ""}
                onChange={change("eventDate")}
              />
            </Field>
            <Field
              name="eventTime"
              hint="Use the local time of the event, if known."
              error={errors.eventTime}
            >
              <input
                id="f-eventTime"
                type="time"
                className={control}
                value={values.eventTime ?? ""}
                onChange={change("eventTime")}
              />
            </Field>
            <Field name="location" required error={errors.location}>
              {select("location", LOCATIONS)}
            </Field>
            {values.location === "Inside a campus building" && (
              <Field name="buildingName" required error={errors.buildingName}>
                <input
                  id="f-buildingName"
                  className={control}
                  value={values.buildingName ?? ""}
                  onChange={change("buildingName")}
                  maxLength={80}
                />
              </Field>
            )}
            <Field name="shift" required error={errors.shift}>
              {select("shift", SHIFTS)}
            </Field>
          </Section>

          <Section
            id="event-details"
            number="2"
            title="What happened"
            description="Choose the event details and describe what you observed."
            disabled={saving}
          >
            <Field name="eventType" required error={errors.eventType}>
              {select("eventType", EVENT_TYPES)}
            </Field>
            <Field
              name="severity"
              required
              hint={
                nearMiss
                  ? "Near misses and unsafe conditions must use None."
                  : undefined
              }
              error={errors.severity}
            >
              {select("severity", SEVERITIES)}
            </Field>
            {values.severity === "Days away from work" && (
              <Field
                name="daysAway"
                required
                hint="Whole number from 1 to 180."
                error={errors.daysAway}
              >
                <input
                  id="f-daysAway"
                  type="number"
                  min={1}
                  max={180}
                  className={control}
                  value={values.daysAway ?? ""}
                  onChange={change("daysAway")}
                />
              </Field>
            )}
            <Field name="equipment" required error={errors.equipment}>
              {select("equipment", EQUIPMENT)}
            </Field>
            {values.severity === "Hospitalization" && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:col-span-2">
                <strong>Reminder:</strong> an in-patient hospitalization must be
                reported to TOSHA within 24 hours (a work-related death within 8
                hours). Source: Tenn. Comp. R. &amp; Regs. 0800-01-03-.05(1)(a).
                This app does not file the report for you.
              </div>
            )}
            <div className="sm:col-span-2">
              <Field
                name="description"
                required
                hint={`Describe the event without injured-person names or medical details. 20–2,000 characters; ${(values.description ?? "").length} entered.`}
                error={errors.description}
              >
                <textarea
                  id="f-description"
                  rows={5}
                  className={control}
                  value={values.description ?? ""}
                  onChange={change("description")}
                  maxLength={2000}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field
                name="immediateAction"
                hint="What was done immediately afterward? Up to 1,000 characters."
                error={errors.immediateAction}
              >
                <textarea
                  id="f-immediateAction"
                  rows={3}
                  className={control}
                  value={values.immediateAction ?? ""}
                  onChange={change("immediateAction")}
                  maxLength={1000}
                />
              </Field>
            </div>
          </Section>

          <Section
            id="reporter"
            number="3"
            title="Reporter details"
            description="Use a fictional name and email for this classroom demo."
            disabled={saving}
          >
            <Field name="reporterName" required error={errors.reporterName}>
              <input
                id="f-reporterName"
                className={control}
                value={values.reporterName ?? ""}
                onChange={change("reporterName")}
                maxLength={80}
                autoComplete="off"
                placeholder="Demo Reporter"
              />
            </Field>
            <Field name="reporterEmail" required error={errors.reporterEmail}>
              <input
                id="f-reporterEmail"
                type="email"
                inputMode="email"
                className={control}
                value={values.reporterEmail ?? ""}
                onChange={change("reporterEmail")}
                maxLength={254}
                autoComplete="off"
                placeholder="reporter@example.test"
              />
            </Field>
          </Section>

          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="mb-4 text-sm leading-6 text-slate-600">
              {storageDescription}
            </p>
            <p className="mb-4 text-sm leading-6 text-slate-600 lg:hidden">
              Need to check a procedure?{" "}
              <Link
                href="/assistant"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-teal-800 underline underline-offset-2"
              >
                Open the safety assistant in a new tab
              </Link>
              .
            </p>
            {!ready && !loadError && (
              <p role="status" className="mb-3 text-sm text-slate-600">
                Preparing report storage...
              </p>
            )}
            <button
              type="submit"
              disabled={!ready || saving}
              className={`${action} w-full bg-teal-700 text-white hover:bg-teal-800 sm:w-auto`}
            >
              {saving ? "Saving report..." : "Save report"}
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Saving creates an Open record. It does not submit a report to a
              university or regulator.
            </p>
          </div>
        </form>

        <aside
          className="hidden rounded-xl border border-teal-100 bg-teal-50/70 p-5 lg:sticky lg:top-6 lg:block"
          aria-labelledby="report-checklist"
        >
          <h2 id="report-checklist" className="font-semibold text-teal-950">
            Before you save
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-teal-950">
            <li>Use the event date, location and shift.</li>
            <li>Describe observable facts and immediate actions.</li>
            <li>Keep injured-person names and medical details out.</li>
            <li>Use fictional reporter details for the demo.</li>
          </ul>
          <p className="mt-5 border-t border-teal-200 pt-4 text-sm leading-6 text-teal-950">
            Need to check a procedure?{" "}
            <Link
              href="/assistant"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              Open the safety assistant in a new tab
            </Link>{" "}
            to keep this form open.
          </p>
        </aside>
      </div>
    </div>
  );
}
