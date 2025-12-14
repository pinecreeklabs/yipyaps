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

const geolocationMiddleware = createMiddleware().server(async ({ next, request }) => {
  const cf = (request as any).cf
  const url = new URL(request.url)
  const hostname = url.hostname

  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || !cf
  const userCity = cf?.city || null
  const subdomain = isLocalDev ? null : extractSubdomain(hostname)
  const userCitySlug = normalizeCitySlug(userCity)
  const canPost = isLocalDev || (!!subdomain && userCitySlug === subdomain)

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
