import { Suspense } from "react";
import Link from "next/link";
import { pageUser } from "@/lib/server-access";
async function Check({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  return user?.role === "admin" ? (
    children
  ) : (
    <section className="rounded-xl border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-bold">Administrator access required</h1>
      <p className="mt-3">
        Your account can create reports, view your own reports, and use the
        assistant.
      </p>
      <Link href="/" className="btn-primary mt-5">
        Return to your workspace
      </Link>
    </section>
  );
}
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p>Checking access…</p>}>
      <Check>{children}</Check>
    </Suspense>
  );
}
