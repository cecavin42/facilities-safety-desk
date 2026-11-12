import { TOPICS } from "./topics";
export const ROUTING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topicIds", "fullyCovered"],
  properties: {
    topicIds: {
      type: "array",
      maxItems: 4,
      uniqueItems: true,
      items: { type: "string", enum: TOPICS.map((t) => t.id) },
    },
    passageIds: {
      type: "array",
      maxItems: 3,
      uniqueItems: true,
      items: { type: "string" },
    },
    fullyCovered: { type: "boolean" },
  },
};
export function parseRouting(
  content: string,
  allowedPassages: string[] = [],
  allowedTopics: string[] = TOPICS.map((t) => t.id),
): { topicIds: string[]; fullyCovered: boolean; passageIds?: string[] } {
  if (content.length > 4000) throw new Error("Oversized model response");
  const data: unknown = JSON.parse(content);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid model response");
  const value = data as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (k) => !["topicIds", "fullyCovered", "passageIds"].includes(k),
    ) ||
    typeof value.fullyCovered !== "boolean" ||
    !Array.isArray(value.topicIds) ||
    value.topicIds.length > 4 ||
    value.topicIds.some(
      (id) => typeof id !== "string" || !allowedTopics.includes(id),
    ) ||
    new Set(value.topicIds).size !== value.topicIds.length
  )
    throw new Error("Invalid routing result");
  if (
    value.passageIds !== undefined &&
    (!Array.isArray(value.passageIds) ||
      value.passageIds.length > 3 ||
      value.passageIds.some(
        (id) => typeof id !== "string" || !allowedPassages.includes(id),
      ) ||
      new Set(value.passageIds).size !== value.passageIds.length)
  )
    throw new Error("Invalid evidence selection");
  return {
    topicIds: value.topicIds as string[],
    fullyCovered: value.fullyCovered,
    ...(value.passageIds === undefined
      ? {}
      : { passageIds: value.passageIds as string[] }),
  };
}
