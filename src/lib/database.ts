import "server-only";
import type { Pool } from "pg";
import { createPool } from "./db/pool";

const state = globalThis as typeof globalThis & { safetyDeskPool?: Pool };

export function database() {
  // Lazy initialization lets builds run without contacting a database.
  return state.safetyDeskPool ??= createPool();
}
