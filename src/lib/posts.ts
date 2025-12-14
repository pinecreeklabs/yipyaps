import { createServerFn, createMiddleware } from '@tanstack/react-start'
import { getDb, posts } from '@/db'
import { desc, eq } from 'drizzle-orm'
import { extractSubdomain, parseCookie } from './geolocation'

const RADIUS_MILES = 20

// Haversine formula to calculate distance between two points in miles
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const cityMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as Request & { cf?: unknown }).cf
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
  .inputValidator((data?: { userLat?: number; userLng?: number; viewCity?: string }) => data || {})
  .handler(async ({ context, data }) => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const db = getDb(env.DB)

    console.log('[getPosts] Request:', {
      viewCity: data?.viewCity,
      hasCoords: data?.userLat !== undefined,
      subdomain: context.subdomain,
      userCitySlug: context.userCitySlug,
    })

    try {
      // If viewing a specific city (from dropdown), show all posts from that city
      if (data?.viewCity) {
        const result = await db
          .select()
          .from(posts)
          .where(eq(posts.city, data.viewCity))
          .orderBy(desc(posts.createdAt))
          .all()
        console.log('[getPosts] Returned', result.length, 'posts for city:', data.viewCity)
        return result
      }

      // Nearby = your city + 20mi radius
      const allPosts = await db
        .select()
        .from(posts)
        .orderBy(desc(posts.createdAt))
        .all()

      // Filter: posts from user's city OR within 20mi radius
      const userCity = context.subdomain || context.userCitySlug
      const hasCoords = data?.userLat !== undefined && data?.userLng !== undefined

      const filtered = allPosts.filter(post => {
        // Include all posts from user's city
        if (userCity && post.city === userCity) return true

        // Include posts within 20mi radius (if we have user coords and post has coords)
        if (hasCoords && post.latitude && post.longitude) {
          const postLat = parseFloat(post.latitude)
          const postLng = parseFloat(post.longitude)
          const distance = haversineDistance(data!.userLat!, data!.userLng!, postLat, postLng)
          return distance <= RADIUS_MILES
        }

        return false
      })

      console.log('[getPosts] Returned', filtered.length, 'of', allPosts.length, 'posts for user city:', userCity)
      return filtered
    } catch (error) {
      console.error('[getPosts] Database error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { viewCity: data?.viewCity, subdomain: context.subdomain },
      })
      throw new Error('Failed to load posts. Please try again.')
    }
  })

export const createPost = createServerFn({ method: 'POST' })
  .middleware([cityMiddleware])
  .inputValidator((data: { content: string; city?: string; latitude?: number; longitude?: number }) => data)
  .handler(async ({ data, context }) => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const db = getDb(env.DB)

    const { content, latitude, longitude } = data
    const { subdomain, canPost, isLocalDev } = context

    console.log('[createPost] Request received:', {
      content: content?.substring(0, 50),
      latitude,
      longitude,
      subdomain,
      canPost,
      isLocalDev,
      dataCity: data.city,
    })

    if (!content?.trim()) {
      console.error('[createPost] Validation failed: empty content')
      throw new Error('Post content is required')
    }

    const city = isLocalDev ? (data.city || 'dev') : subdomain

    if (!city) {
      console.error('[createPost] Validation failed: no city', { subdomain, isLocalDev })
      throw new Error('Posts can only be created on city subdomains')
    }

    if (!isLocalDev && !canPost) {
      console.error('[createPost] Permission denied:', { subdomain, userCitySlug: context.userCitySlug })
      throw new Error(`You must be in ${subdomain} to post here`)
    }

    const insertValues = {
      content: content.trim(),
      city,
      latitude: latitude !== undefined ? String(latitude) : null,
      longitude: longitude !== undefined ? String(longitude) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    console.log('[createPost] Inserting:', {
      ...insertValues,
      content: insertValues.content.substring(0, 50),
    })

    try {
      const result = await db
        .insert(posts)
        .values(insertValues)
        .returning()

      console.log('[createPost] Success:', { postId: result[0]?.id, city })
      return result
    } catch (error) {
      console.error('[createPost] Database error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        insertValues: { ...insertValues, content: insertValues.content.substring(0, 50) },
      })
      throw new Error('Failed to create post. Please try again.')
    }
  })

export const getCities = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const db = getDb(env.DB)

    console.log('[getCities] Fetching all cities')

    try {
      const result = await db
        .select({ city: posts.city })
        .from(posts)
        .groupBy(posts.city)
        .all()

      const cities = result.map(r => r.city)
      console.log('[getCities] Found', cities.length, 'cities:', cities)
      return cities
    } catch (error) {
      console.error('[getCities] Database error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw new Error('Failed to load cities. Please try again.')
    }
  })
