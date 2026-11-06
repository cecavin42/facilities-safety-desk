"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { CurrentUser } from "@/lib/access";
const Context = createContext<CurrentUser | null>(null);
export function SessionUser({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return <Context.Provider value={user}>{children}</Context.Provider>;
}
export function useCurrentUser() {
  const user = useContext(Context);
  if (!user) throw new Error("Sign-in context is missing");
  return user;
}
export async function signOut() {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok)
    throw new Error("Sign-out was not confirmed. Please retry.");
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("fsa.report-draft.")) sessionStorage.removeItem(key);
    localStorage.setItem("fsa.session-event", crypto.randomUUID());
  } catch {
    /* Server revocation succeeded even when browser storage is unavailable. */
  }
  window.location.replace("/sign-in");
}
