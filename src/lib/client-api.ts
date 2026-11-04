export async function api<T>(
  url: string,
  init?: RequestInit,
  options?: { redirectOnUnauthorized?: boolean },
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (response.status === 401 && options?.redirectOnUnauthorized !== false) {
    window.location.replace("/sign-in");
    throw new Error("Your session has ended. Sign in again.");
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : "The request could not be completed.",
    );
  return data;
}
