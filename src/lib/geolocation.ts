import { createServerFn, createMiddleware } from '@tanstack/react-start'

export interface LocationData {
  city: string | null
  region: string | null
  country: string | null
}

export interface CityContext {
  subdomain: string | null
  userCity: string | null
  userCitySlug: string | null
  canPost: boolean
  isLocalDev: boolean
  locationData: LocationData
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
  // subdomain.yipyaps.com = 3 parts
  if (parts.length >= 3 && parts[parts.length - 2] === 'yipyaps') {
    return parts[0].toLowerCase()
  }
  return null
}

const geolocationMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as any).cf
  const url = new URL(request.url)
  const hostname = url.hostname

  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || !cf

  const locationData: LocationData = {
    city: cf?.city || null,
    region: cf?.region || null,
    country: cf?.country || null,
  }

  const subdomain = isLocalDev ? null : extractSubdomain(hostname)
  const userCitySlug = normalizeCitySlug(locationData.city)
  const canPost = isLocalDev || (!!subdomain && userCitySlug === subdomain)

  console.log('[Geolocation]', {
    hostname,
    isLocalDev,
    city: locationData.city,
    subdomain,
    userCitySlug,
    canPost,
  })

  return next({
    context: { locationData, subdomain, userCitySlug, canPost, isLocalDev },
  })
})

export const getCityContext = createServerFn({ method: 'GET' })
  .middleware([geolocationMiddleware])
  .handler(async ({ context }): Promise<CityContext> => {
    console.log('[getCityContext]', {
      subdomain: context.subdomain,
      userCity: context.locationData.city,
      canPost: context.canPost,
    })
    return {
      subdomain: context.subdomain,
      userCity: context.locationData.city,
      userCitySlug: context.userCitySlug,
      canPost: context.canPost,
      isLocalDev: context.isLocalDev,
      locationData: context.locationData,
    }
  })

export interface ReverseGeocodeResult {
  city: string | null
  citySlug: string | null
}

interface NominatimResponse {
  address?: {
    city?: string
    town?: string
    village?: string
  }
}

export const reverseGeocode = createServerFn({ method: 'GET' })
  .inputValidator((data: { lat: number; lng: number }) => data)
  .handler(async ({ data }): Promise<ReverseGeocodeResult> => {
    console.log('[reverseGeocode] Request:', { lat: data.lat, lng: data.lng })
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${data.lat}&lon=${data.lng}&format=json`,
        { headers: { 'User-Agent': 'Yipyaps/1.0' } }
      )
      const result: NominatimResponse = await response.json()
      const city = result.address?.city || result.address?.town || result.address?.village || null
      console.log('[reverseGeocode] Result:', { city, address: result.address })
      return {
        city,
        citySlug: normalizeCitySlug(city),
      }
    } catch (err) {
      console.error('[reverseGeocode] Error:', err)
      return { city: null, citySlug: null }
    }
  })
