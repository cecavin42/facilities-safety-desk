import { database } from "@/lib/database";
import { readData } from "@/lib/db/repository";
import { failure } from "@/lib/api";
import { connection } from "next/server";

export async function GET() {
  await connection();
  try { return Response.json(await readData(database()), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error, "read"); }
}
