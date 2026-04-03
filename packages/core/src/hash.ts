import { createHash } from "node:crypto";

import type { ActionKind, ActionPayloadByKind, JsonObject, JsonValue } from "./types";

function stableSerialize(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
    case "boolean":
      return JSON.stringify(value);
    default: {
      const objectValue = value as JsonObject;
      const keys = Object.keys(objectValue).sort();
      const entries = keys.map(
        (key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key] as JsonValue)}`
      );
      return `{${entries.join(",")}}`;
    }
  }
}

export function stableStringify(value: JsonValue): string {
  return stableSerialize(value);
}

export function hashActionPayload<K extends ActionKind>(
  kind: K,
  payload: ActionPayloadByKind[K]
): string {
  return createHash("sha256")
    .update(stableStringify({ kind, payload } as JsonObject))
    .digest("hex");
}
