import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCityContext, type CityContext } from '../lib/geolocation'
import { getPosts, createPost } from '../lib/posts'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import type { Post } from '../db/schema'

export const Route = createFileRoute('/')({
  component: Home,
  loader: async (): Promise<{ cityContext: CityContext; posts: Post[] }> => {
    const cityContext = await getCityContext()

    // Redirect to user's city on main domain (prod only)
    if (!cityContext.isLocalDev && !cityContext.subdomain && cityContext.userCitySlug) {
      throw redirect({
        href: `https://${cityContext.userCitySlug}.yipyaps.com`,
        statusCode: 302,
      })
    }

    const posts = await getPosts()
    return { cityContext, posts }
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
]

const ROTATIONS = ['rotate-[-2deg]', 'rotate-[1.5deg]', 'rotate-[-1deg]', 'rotate-[2deg]', 'rotate-[0.5deg]', 'rotate-[-1.5deg]']

function Home() {
  const { cityContext, posts: initialPosts } = Route.useLoaderData()
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [noteText, setNoteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cityName = cityContext.subdomain ? formatCityName(cityContext.subdomain) : (cityContext.isLocalDev ? 'Dev Mode' : 'Your City')
  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0

  const handlePost = async () => {
    if (!noteText.trim() || isSubmitting || wordCount > 10) return
    setIsSubmitting(true)
    try {
      const result = await createPost({ data: { content: noteText.trim() } })
      if (result?.[0]) {
        setPosts([result[0], ...posts])
      }
      setNoteText('')
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
          <p className="mt-3 text-balance text-lg text-muted-foreground md:text-xl">
            Anonymous notes from {cityName}
          </p>
        </header>

        <div className="mb-12 flex justify-center">
          <div className="flex items-baseline gap-2 rounded-full bg-secondary/20 px-6 py-3">
            <span className="text-4xl font-bold text-secondary">{posts.length.toLocaleString()}</span>
            <span className="text-sm font-medium text-muted-foreground">posts</span>
          </div>
        </div>

        {cityContext.canPost ? (
          <Card className="mb-16 rotate-[-1deg] border-2 border-secondary/30 bg-secondary/10 p-6 shadow-lg transition-transform hover:scale-[1.01] dark:bg-secondary/5">
            <Textarea
              placeholder="Share a quick note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="mb-4 min-h-[100px] resize-none border-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{wordCount} / 10 words</span>
              <Button
                onClick={handlePost}
                disabled={!noteText.trim() || wordCount > 10 || isSubmitting}
                className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="mb-16 rotate-[1deg] border-2 border-muted bg-muted/50 p-6 text-center shadow-md">
            <p className="text-sm font-medium text-muted-foreground">
              Posting is only available if you're in {cityName}
            </p>
            {cityContext.userCitySlug && (
              <p className="mt-2 text-xs text-muted-foreground">
                Visit{' '}
                <a href={`https://${cityContext.userCitySlug}.yipyaps.com`} className="text-primary underline">
                  {cityContext.userCitySlug}.yipyaps.com
                </a>{' '}
                to post from {cityContext.userCity}
              </p>
            )}
          </Card>
        )}

        <section className="space-y-8">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
            Latest Yips
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <Card
                key={post.id}
                className={`${NOTE_COLORS[index % NOTE_COLORS.length]} ${ROTATIONS[post.id % ROTATIONS.length]} border-2 p-6 shadow-md transition-all hover:scale-[1.03] hover:shadow-lg`}
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
            <p className="text-center text-muted-foreground">No yips yet. Be the first!</p>
          )}
        </section>
      </div>
    </div>
  )
}
