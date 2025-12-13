import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Create a Drizzle database instance from a D1Database binding
 * 
 * @param db - The D1Database binding from Cloudflare Workers environment
 * @returns A Drizzle database instance with schema
 * 
 * Usage:
 * ```ts
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const db = getDb(env.DB);
 *     const posts = await db.select().from(schema.posts).all();
 *     return Response.json(posts);
 *   },
 * };
 * ```
 */
export function getDb(db: D1Database) {
  return drizzle(db, { schema });
}

// Re-export schema for convenience
export * from './schema';
