import { requireUser, json, failure } from "@/lib/server-access";
import { scopedData } from "@/lib/authorized-data";
export async function GET(request: Request) {
  try {
    return json(await scopedData(await requireUser(request)));
  } catch (error) {
    return failure(error);
  }
}
