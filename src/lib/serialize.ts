import { Prisma } from '../generated/prisma/client.js';

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function serialize<T>(data: T): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (data instanceof Prisma.Decimal) {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => serialize(item));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = serialize(value);
    }
    return result;
  }

  return data;
}
