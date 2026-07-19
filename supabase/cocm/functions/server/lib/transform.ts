export function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => toSnakeCase(item));
  }
  if (obj !== null && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce(
      (acc: Record<string, unknown>, key: string) => {
        const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        acc[snakeKey] = toSnakeCase(record[key]);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }
  return obj;
}

export function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => toCamelCase(item));
  }
  if (obj !== null && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    return Object.keys(record).reduce(
      (acc: Record<string, unknown>, key: string) => {
        let camelKey = key.replace(/_([a-z])/g, (_, letter: string) =>
          letter.toUpperCase()
        );

        // Handle special field mappings (photo_url -> photo)
        if (camelKey === "photoUrl") {
          camelKey = "photo";
        }

        acc[camelKey] = toCamelCase(record[key]);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }
  return obj;
}
