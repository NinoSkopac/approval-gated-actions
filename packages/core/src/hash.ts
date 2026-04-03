import { createHash } from "node:crypto";

import type { ActionKind, ActionPayloadByKind, JsonObject, JsonValue } from "./types";

function stableSerialize(value: JsonValue | undefined): string {
  if (value === undefined) {
    return "null";
  }

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
      const keys = Object.keys(objectValue)
        .filter((key) => objectValue[key] !== undefined)
        .sort();
      const entries = keys.map(
        (key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`
      );
      return `{${entries.join(",")}}`;
    }
  }
}

export function stableStringify(value: JsonValue | undefined): string {
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
