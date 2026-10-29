"use client";

import Link from "next/link";
import { useState } from "react";
import {
  EQUIPMENT,
  EVENT_TYPES,
  FIELD_LABELS,
  LOCATIONS,
  SEVERITIES,
  SHIFTS,
  type FormField,
  type ReportInput,
} from "@/lib/options";
import { useAppData } from "@/lib/store";
import { validateReport } from "@/lib/validation";

const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";

export default function ReportPage() {
  const { addRecords } = useAppData();
  const [values, setValues] = useState<ReportInput>({});
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  const set = (k: FormField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...values, [k]: e.target.value };
    if (k === "eventType" && (e.target.value === "Near miss" || e.target.value === "Unsafe condition")) next.severity = "None";
    setValues(next);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateReport(values);
    if (!result.ok) {
      setErrors(result.errors);
      setSavedId(null);
      document.getElementById(`f-${Object.keys(result.errors)[0]}`)?.focus();
      return;
    }
    const [id] = addRecords([result.record]);
    setErrors({});
    setValues({});
    setSavedId(id);
    window.scrollTo({ top: 0 });
  }

  function Field({ name, required, children, hint }: { name: FormField; required?: boolean; children: React.ReactNode; hint?: string }) {
    return (
      <div>
        <label htmlFor={`f-${name}`} className="block text-sm font-medium text-slate-800">
          {FIELD_LABELS[name]}
          {required && <span className="text-red-600"> *</span>}
        </label>
        {children}
        {hint && !errors[name] && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        {errors[name] && (
          <p id={`e-${name}`} className="mt-1 text-sm text-red-700">
            {errors[name]}
          </p>
        )}
      </div>
    );
  }

  const select = (name: FormField, options: readonly string[]) => (
    <select id={`f-${name}`} className={input} value={values[name] ?? ""} onChange={set(name)} aria-invalid={!!errors[name]}>
      <option value="">Choose...</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  const nearMissLike = values.eventType === "Near miss" || values.eventType === "Unsafe condition";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report an incident or near miss</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fields marked <span className="text-red-600">*</span> are required. Do not enter the injured person&apos;s name or
          medical details.
        </p>
      </div>

      {savedId && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          Report {savedId} saved with status Open.{" "}
          <Link href="/records" className="underline">
            See it in Records
          </Link>
          .
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          Please fix the {Object.keys(errors).length === 1 ? "problem" : `${Object.keys(errors).length} problems`} below.
        </div>
      )}

      <form onSubmit={submit} noValidate className="grid gap-5 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
        {Field({ name: "eventDate", required: true, hint: "Not in the future, and no more than 1 year ago.", children: (
          <input id="f-eventDate" type="date" className={input} value={values.eventDate ?? ""} onChange={set("eventDate")} aria-invalid={!!errors.eventDate} />
        ) })}
        {Field({ name: "eventTime", hint: "Optional. 24-hour time, for example 14:30.", children: (
          <input id="f-eventTime" type="time" className={input} value={values.eventTime ?? ""} onChange={set("eventTime")} />
        ) })}
        {Field({ name: "location", required: true, children: select("location", LOCATIONS) })}
        {values.location === "Inside a campus building" &&
          Field({ name: "buildingName", required: true, children: (
            <input id="f-buildingName" className={input} value={values.buildingName ?? ""} onChange={set("buildingName")} maxLength={80} />
          ) })}
        {Field({ name: "shift", required: true, children: select("shift", SHIFTS) })}
        {Field({ name: "eventType", required: true, children: select("eventType", EVENT_TYPES) })}
        {Field({ name: "severity", required: true, hint: nearMissLike ? "Must be None for a near miss or unsafe condition." : undefined, children: select("severity", SEVERITIES) })}
        {values.severity === "Days away from work" &&
          Field({ name: "daysAway", required: true, hint: "Whole number from 1 to 180.", children: (
            <input id="f-daysAway" type="number" min={1} max={180} className={input} value={values.daysAway ?? ""} onChange={set("daysAway")} />
          ) })}
        {Field({ name: "equipment", required: true, children: select("equipment", EQUIPMENT) })}

        {values.severity === "Hospitalization" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
            <strong>Reminder:</strong> an in-patient hospitalization must be reported to TOSHA within 24 hours (a
            work-related death within 8 hours). Source: Tenn. Comp. R. &amp; Regs. 0800-01-03-.05(1)(a). This app does not
            file the report for you.
          </div>
        )}

        <div className="sm:col-span-2">
          {Field({ name: "description", required: true, hint: `20 to 2,000 characters. ${(values.description ?? "").length} so far.`, children: (
            <textarea id="f-description" rows={4} className={input} value={values.description ?? ""} onChange={set("description")} maxLength={2000} />
          ) })}
        </div>
        <div className="sm:col-span-2">
          {Field({ name: "immediateAction", hint: "Optional. Up to 1,000 characters.", children: (
            <textarea id="f-immediateAction" rows={2} className={input} value={values.immediateAction ?? ""} onChange={set("immediateAction")} maxLength={1000} />
          ) })}
        </div>
        {Field({ name: "reporterName", required: true, children: (
          <input id="f-reporterName" className={input} value={values.reporterName ?? ""} onChange={set("reporterName")} maxLength={80} autoComplete="name" />
        ) })}
        {Field({ name: "reporterEmail", required: true, children: (
          <input id="f-reporterEmail" type="email" className={input} value={values.reporterEmail ?? ""} onChange={set("reporterEmail")} autoComplete="email" />
        ) })}

        <div className="sm:col-span-2">
          <button type="submit" className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}
