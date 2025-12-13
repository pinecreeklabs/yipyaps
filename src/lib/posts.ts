import { createServerFn, createMiddleware } from '@tanstack/react-start'
import { getDb, posts } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { extractSubdomain, normalizeCitySlug } from './geolocation'

const cityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as any).cf
  const url = new URL(request.url)
  const hostname = url.hostname

  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || !cf
  const subdomain = isLocalDev ? null : extractSubdomain(hostname)
  const userCitySlug = normalizeCitySlug(cf?.city || null)
  const canPost = isLocalDev || (!!subdomain && userCitySlug === subdomain)

  console.log('[Posts Middleware]', {
    hostname,
    subdomain,
    userCitySlug,
    canPost,
    isLocalDev,
  })

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
      // Filter by city if on subdomain, otherwise return all (dev mode)
      let result
      if (context.subdomain) {
        console.log('[getPosts] Fetching posts for city:', context.subdomain)
        result = await db
          .select()
          .from(posts)
          .where(eq(posts.city, context.subdomain))
          .orderBy(desc(posts.createdAt))
          .all()
      } else {
        console.log('[getPosts] Fetching all posts (dev mode)')
        result = await db.select().from(posts).orderBy(desc(posts.createdAt)).all()
      }

      console.log('[getPosts] Found', result.length, 'posts')
      return result
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

    console.log('[createPost] Attempting to create post', {
      subdomain,
      canPost,
      isLocalDev,
      contentLength: content?.length,
    })

    if (!content?.trim()) {
      console.error('[createPost] Validation failed: content is required')
      throw new Error('Post content is required')
    }

    // In dev mode, use provided city or default to 'dev'
    const city = isLocalDev ? (data.city || 'dev') : subdomain

    if (!city) {
      console.error('[createPost] Validation failed: no city')
      throw new Error('Posts can only be created on city subdomains')
    }

    if (!isLocalDev && !canPost) {
      console.error('[createPost] Permission denied:', { subdomain, userCitySlug: context.userCitySlug })
      throw new Error(`You must be in ${subdomain} to post here`)
    }

    try {
      const result = await db
        .insert(posts)
        .values({ content: content.trim(), city })
        .returning()

      console.log('[createPost] Successfully created post:', {
        id: result[0]?.id,
        city,
        contentLength: content.trim().length,
      })

      return result
    } catch (error) {
      console.error('[createPost] Database error:', error)
      throw error
    }
  })
