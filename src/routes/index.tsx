import { useState, useEffect } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCityContext, resolveCityFromCoords, type CityContext } from '../lib/geolocation'
import { getPosts, createPost, getCities } from '../lib/posts'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { CityOnboardingModal } from '../components/city-onboarding-modal'
import type { Post } from '../db/schema'

interface UserLocation {
  latitude: number
  longitude: number
}

export const Route = createFileRoute('/')({
  component: Home,
  loader: async (): Promise<{ cityContext: CityContext; cities: string[] }> => {
    const cityContext = await getCityContext()

    // Redirect to user's city on main domain ONLY if GPS cookie exists (no IP fallback)
    if (!cityContext.isLocalDev && !cityContext.subdomain && cityContext.userCitySlug) {
      throw redirect({
        href: `https://${cityContext.userCitySlug}.yipyaps.com`,
        statusCode: 302,
      })
    }

    const cities = await getCities()
    return { cityContext, cities }
  },
})

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatCityName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const NOTE_COLORS = [
  'bg-blue-100 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
  'bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
  'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
  'bg-rose-100 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
  'bg-purple-100 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900',
  'bg-cyan-100 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900',
  'bg-pink-100 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900',
  'bg-indigo-100 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900',
  'bg-orange-100 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900',
  'bg-teal-100 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900',
]

const ROTATIONS = ['rotate-[-2deg]', 'rotate-[1.5deg]', 'rotate-[-1deg]', 'rotate-[2deg]', 'rotate-[0.5deg]', 'rotate-[-1.5deg]']

function getRandomColor(postId: number): string {
  return NOTE_COLORS[postId % NOTE_COLORS.length]
}

function Home() {
  const { cityContext, cities } = Route.useLoaderData()
  const [posts, setPosts] = useState<Post[]>([])
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [viewCity, setViewCity] = useState<string | null>(null)

  const isOnboarding = !cityContext.subdomain && !cityContext.userCitySlug

  // Fetch posts when user has location or is viewing a specific city
  useEffect(() => {
    if (isOnboarding) return

    const fetchPosts = async () => {
      try {
        const freshPosts = await getPosts({
          data: viewCity
            ? { viewCity }
            : userLocation
              ? { userLat: userLocation.latitude, userLng: userLocation.longitude }
              : undefined
        })
        setPosts(freshPosts)
      } catch {}
    }

    fetchPosts()
    const interval = setInterval(fetchPosts, 5000)
    return () => clearInterval(interval)
  }, [isOnboarding, userLocation, viewCity])

  // Get user location on mount (after onboarding)
  useEffect(() => {
    if (isOnboarding || userLocation) return

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {}, // Silently fail, posts will use subdomain fallback
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    )
  }, [isOnboarding, userLocation])

  const cityName = cityContext.subdomain
    ? formatCityName(cityContext.subdomain)
    : cityContext.userCitySlug
      ? formatCityName(cityContext.userCitySlug)
      : 'Your Area'
  const charCount = noteText.trim().length

  const handleFindCity = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      const { latitude, longitude } = position.coords

      // Call server function to reverse geocode
      const result = await resolveCityFromCoords({ data: { latitude, longitude } })

      // Set cross-subdomain cookie
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const cookieDomain = isLocalhost ? '' : '; Domain=.yipyaps.com'
      const secureFlag = isLocalhost ? '' : '; Secure'
      document.cookie = `yipyaps_city_slug=${result.citySlug}; Path=/; Max-Age=86400${secureFlag}; SameSite=Lax${cookieDomain}`

      // Redirect to city subdomain (or reload on localhost)
      if (isLocalhost) {
        window.location.reload()
      } else {
        window.location.href = `https://${result.citySlug}.yipyaps.com`
      }
    } catch (error: any) {
      console.error('[FindCity] Error:', error)
      if (error && typeof error.code === 'number') {
        // GeolocationPositionError
        if (error.code === 1) { // PERMISSION_DENIED
          setLocationError('Location permission denied. Please enable location access to find your city.')
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          setLocationError('Location unavailable. Please try again.')
        } else { // TIMEOUT
          setLocationError('Location request timed out. Please try again.')
        }
      } else {
        // Server error - extract message if available
        const errorMessage = error?.message || error?.data?.message || String(error)
        if (errorMessage.includes('GOOGLE_MAPS_API_KEY')) {
          setLocationError('Location service not configured. Please contact support.')
        } else if (errorMessage.includes('Geocoding failed')) {
          setLocationError('Could not determine your city from GPS coordinates. Please try again.')
        } else {
          setLocationError(`Failed to determine your city: ${errorMessage}`)
        }
      }
      setIsLocating(false)
    }
  }

  const handlePost = async () => {
    if (!noteText.trim() || isSubmitting || charCount > 140) return
    setIsSubmitting(true)
    try {
      await createPost({
        data: {
          content: noteText.trim(),
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
        }
      })
      setNoteText('')
      const freshPosts = await getPosts({
        data: userLocation
          ? { userLat: userLocation.latitude, userLng: userLocation.longitude }
          : undefined
      })
      setPosts(freshPosts)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <header className="mb-16 text-center">
          <h1 className="text-balance font-[family-name:var(--font-display)] text-7xl font-bold tracking-tight text-primary md:text-8xl">
            Yipyaps
          </h1>
          {isOnboarding ? (
            <p className="mt-3 text-balance text-lg text-muted-foreground md:text-xl">
              Share quick notes with your city
            </p>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-2 text-lg text-muted-foreground md:text-xl">
              <span>Notes from</span>
              <select
                value={viewCity || ''}
                onChange={(e) => setViewCity(e.target.value || null)}
                className="cursor-pointer appearance-none border-b-2 border-dashed border-primary/40 bg-transparent px-1 font-medium text-primary hover:border-primary focus:border-primary focus:outline-none"
              >
                <option value="">{cityName} + Nearby</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {formatCityName(city)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        <CityOnboardingModal open={isOnboarding} />

        {!isOnboarding && (
          <>
            <div className="mb-12 flex justify-center">
              <div className="flex items-baseline gap-2 rounded-full bg-secondary/20 px-6 py-3">
                <span className="text-4xl font-bold text-secondary">{posts.length.toLocaleString()}</span>
                <span className="text-sm font-medium text-muted-foreground">
                  {viewCity ? 'posts' : 'posts nearby'}
                </span>
              </div>
            </div>

            {cityContext.canPost && !viewCity ? (
              <Card className="mb-16 rotate-[-1deg] border-2 border-secondary/30 bg-secondary/10 p-6 shadow-lg transition-transform hover:scale-[1.01] dark:bg-secondary/5">
                <Textarea
                  placeholder="Share a quick note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="mb-4 min-h-[100px] resize-none border-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{charCount} / 140</span>
                  <Button
                    onClick={handlePost}
                    disabled={!noteText.trim() || charCount > 140 || isSubmitting}
                    className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
                  >
                    {isSubmitting ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </Card>
            ) : !viewCity ? (
              <Card className="mb-16 rotate-[1deg] border-2 border-muted bg-muted/50 p-6 text-center shadow-md">
                <p className="text-sm font-medium text-muted-foreground">
                  {cityContext.subdomain
                    ? `Verify you're in ${cityName} to post`
                    : 'Posting is only available if you\'re in your city'}
                </p>
                {cityContext.subdomain ? (
                  <div className="mt-4">
                    <Button
                      onClick={handleFindCity}
                      disabled={isLocating}
                      variant="outline"
                      className="font-medium"
                    >
                      {isLocating ? 'Verifying...' : 'Verify location'}
                    </Button>
                    {locationError && (
                      <p className="mt-3 text-xs text-destructive">{locationError}</p>
                    )}
                  </div>
                ) : cityContext.userCitySlug ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Visit{' '}
                    <a href={`https://${cityContext.userCitySlug}.yipyaps.com`} className="text-primary underline">
                      {cityContext.userCitySlug}.yipyaps.com
                    </a>{' '}
                    to post from {cityContext.userCity}
                  </p>
                ) : null}
              </Card>
            ) : null}

            <section className="space-y-8">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
                {viewCity ? `Yips from ${formatCityName(viewCity)}` : 'Latest Yips'}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Card
                    key={post.id}
                    className={`${getRandomColor(post.id)} ${ROTATIONS[post.id % ROTATIONS.length]} border-2 p-6 shadow-md transition-all hover:scale-[1.03] hover:shadow-lg`}
                  >
                    <p className="text-pretty text-base font-medium leading-relaxed text-card-foreground">
                      {post.content}
                    </p>
                    <p className="mt-4 text-xs font-medium text-muted-foreground">
                      {formatTimeAgo(post.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
              {posts.length === 0 && (
                <p className="text-center text-muted-foreground">
                  {viewCity ? `No yips from ${formatCityName(viewCity)} yet.` : 'No yips nearby yet. Be the first!'}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
