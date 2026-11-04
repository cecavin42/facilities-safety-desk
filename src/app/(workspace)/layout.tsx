import { Suspense } from "react";
import { redirect } from "next/navigation";
import { pageUser } from "@/lib/server-access";
import { SessionUser } from "@/components/SessionUser";
import Nav from "@/components/Nav";
async function Workspace({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  if (!user) redirect("/sign-in");
  return (
    <SessionUser user={user} key={user.id}>
      <Nav />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6"
      >
        {children}
      </main>
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
