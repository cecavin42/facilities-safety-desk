import type { ReactNode } from "react";
export default function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-800">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
      </div>
      {children && (
        <div className="no-print flex flex-wrap gap-2">{children}</div>
      )}
    </header>
  );
}
