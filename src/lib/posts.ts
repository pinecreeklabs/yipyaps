import { createServerFn, createMiddleware } from '@tanstack/react-start'
import { getDb, posts } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { extractSubdomain, parseCookie } from './geolocation'

const cityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as any).cf
  const url = new URL(request.url)
  const hostname = url.hostname

  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || !cf
  const subdomain = isLocalDev ? null : extractSubdomain(hostname)
  
  // Read GPS-derived city slug from cookie (no IP fallback)
  const cookieHeader = request.headers.get('cookie')
  const cookieCitySlug = parseCookie(cookieHeader, 'yipyaps_city_slug')
  
  const userCitySlug = cookieCitySlug || null
  
  // canPost is true if: local dev OR (on subdomain AND cookie matches subdomain)
  const canPost = isLocalDev || (!!subdomain && !!cookieCitySlug && cookieCitySlug === subdomain)

  return next({
    context: { subdomain, userCitySlug, canPost, isLocalDev },
  })
})

export const getPosts = createServerFn({ method: 'GET' })
  .middleware([cityMiddleware])
  .handler(async ({ context }) => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const db = getDb(env.DB)

    try {
      if (context.subdomain) {
        return await db
          .select()
          .from(posts)
          .where(eq(posts.city, context.subdomain))
          .orderBy(desc(posts.createdAt))
          .all()
      }
      return await db.select().from(posts).orderBy(desc(posts.createdAt)).all()
    } catch (error) {
      console.error('[getPosts] Error:', error)
      throw error
    }
  })

export const createPost = createServerFn({ method: 'POST' })
  .middleware([cityMiddleware])
  .inputValidator((data: { content: string; city?: string }) => data)
  .handler(async ({ data, context }) => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const db = getDb(env.DB)

    const { content } = data
    const { subdomain, canPost, isLocalDev } = context

    if (!content?.trim()) {
      throw new Error('Post content is required')
    }

    const city = isLocalDev ? (data.city || 'dev') : subdomain

    if (!city) {
      throw new Error('Posts can only be created on city subdomains')
    }

    if (!isLocalDev && !canPost) {
      console.error('[createPost] Permission denied:', { subdomain, userCitySlug: context.userCitySlug })
      throw new Error(`You must be in ${subdomain} to post here`)
    }

    try {
      return await db
        .insert(posts)
        .values({ content: content.trim(), city })
        .returning()
    } catch (error) {
      console.error('[createPost] Database error:', error)
      throw error
    }
  })
