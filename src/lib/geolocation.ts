import { createServerFn, createMiddleware } from '@tanstack/react-start'

export interface CityContext {
  subdomain: string | null
  userCity: string | null
  userCitySlug: string | null
  canPost: boolean
  isLocalDev: boolean
}

export function normalizeCitySlug(city: string | null): string | null {
  if (!city) return null
  return city
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.')
  if (parts.length >= 3 && parts[parts.length - 2] === 'yipyaps') {
    return parts[0].toLowerCase()
  }
  return null
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map(c => c.trim())
  const cookie = cookies.find(c => c.startsWith(`${name}=`))
  if (!cookie) return null
  return cookie.split('=')[1] || null
}

const geolocationMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as any).cf
  const url = new URL(request.url)
  const hostname = url.hostname

  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || !cf
  const subdomain = isLocalDev ? null : extractSubdomain(hostname)
  
  // Read GPS-derived city slug from cookie (no IP fallback)
  const cookieHeader = request.headers.get('cookie')
  const cookieCitySlug = parseCookie(cookieHeader, 'yipyaps_city_slug')
  
  const userCitySlug = cookieCitySlug || null
  const userCity = cookieCitySlug ? cookieCitySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null
  
  // canPost is true if: local dev OR (on subdomain AND cookie matches subdomain)
  const canPost = isLocalDev || (!!subdomain && !!cookieCitySlug && cookieCitySlug === subdomain)

  return next({
    context: { userCity, subdomain, userCitySlug, canPost, isLocalDev },
  })
})

export const getCityContext = createServerFn({ method: 'GET' })
  .middleware([geolocationMiddleware])
  .handler(async ({ context }): Promise<CityContext> => {
    return {
      subdomain: context.subdomain,
      userCity: context.userCity,
      userCitySlug: context.userCitySlug,
      canPost: context.canPost,
      isLocalDev: context.isLocalDev,
    }
  })

export interface ResolveCityResult {
  cityName: string
  citySlug: string
}

export const resolveCityFromCoords = createServerFn({ method: 'POST' })
  .inputValidator((data: { latitude: number; longitude: number }) => {
    if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      throw new Error('Invalid coordinates')
    }
    if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
      throw new Error('Coordinates out of range')
    }
    return data
  })
  .handler(async ({ data }): Promise<ResolveCityResult> => {
    const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
    const apiKey = (env as any).GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not configured')
    }

    const { latitude, longitude } = data

    // Round coordinates for logging (2 decimals)
    const latRounded = Math.round(latitude * 100) / 100
    const lngRounded = Math.round(longitude * 100) / 100

    console.log('[Geocode] Request:', JSON.stringify({
      lat: latRounded,
      lng: lngRounded,
    }))

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      )

      if (!response.ok) {
        throw new Error(`Google Geocoding API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.status !== 'OK' || !result.results?.length) {
        throw new Error(`Geocoding failed: ${result.status}`)
      }

      // Find city from address components (look for "locality" type)
      let cityName: string | null = null
      for (const component of result.results[0].address_components) {
        if (component.types.includes('locality')) {
          cityName = component.long_name
          break
        }
        // Fallback to sublocality or administrative_area_level_2
        if (!cityName && component.types.includes('sublocality')) {
          cityName = component.long_name
        }
        if (!cityName && component.types.includes('administrative_area_level_2')) {
          cityName = component.long_name
        }
      }

      if (!cityName) {
        throw new Error('Could not determine city from coordinates')
      }

      const citySlug = normalizeCitySlug(cityName)

      if (!citySlug) {
        throw new Error('Could not normalize city name')
      }

      console.log('[Geocode] Success:', JSON.stringify({
        lat: latRounded,
        lng: lngRounded,
        cityName,
        citySlug,
      }))

      return { cityName, citySlug }
    } catch (error) {
      console.error('[Geocode] Error:', JSON.stringify({
        lat: latRounded,
        lng: lngRounded,
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  })
