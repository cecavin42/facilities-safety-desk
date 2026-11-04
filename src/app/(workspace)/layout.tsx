import { Suspense } from "react";
import { redirect } from "next/navigation";
import { pageUser } from "@/lib/server-access";
import { SessionUser } from "@/components/SessionUser";
import AppShell from "@/components/AppShell";
async function Workspace({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  if (!user) redirect("/sign-in");
  return (
    <SessionUser user={user} key={user.id}>
      <AppShell>{children}</AppShell>
    </SessionUser>
  );
}
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Checking your session…
        </p>
      }
    >
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
