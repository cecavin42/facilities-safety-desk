import "server-only";
import { createAuth } from "./auth-config";
import { database } from "./database";
let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth(database()));
}
