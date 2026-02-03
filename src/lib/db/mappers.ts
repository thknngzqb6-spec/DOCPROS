/** Convert a snake_case string to camelCase */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Convert all keys of a SQL row from snake_case to camelCase */
export function mapRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in row) {
    result[snakeToCamel(key)] = row[key];
  }
  return result as T;
}

/** Convert SQLite INTEGER (0/1) to boolean */
export function toBool(val: unknown): boolean {
  return val === 1 || val === true;
}
