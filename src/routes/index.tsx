import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { formatTimeAgo, getRandomColor, ROTATIONS } from '@/lib/constants'
import { useLocation } from '@/lib/hooks/use-location'
import { useCreatePost, usePosts } from '@/lib/tanstack/hooks/use-posts'
import { LocationPromptModal } from '../components/location-prompt-modal'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'

export const Route = createFileRoute('/')({
    component: Home,
})

function Home() {
    const { userLocation, setUserLocation, showLocationPrompt, setShowLocationPrompt } = useLocation()

    const [noteText, setNoteText] = useState('')
    const [postError, setPostError] = useState<string | null>(null)
    const [locationError, setLocationError] = useState<string | null>(null)

    const { data: posts = [] } = usePosts(userLocation)
    const { mutate: createPostMutation, isPending: isCreatingPost } = useCreatePost(userLocation)

    const handleLocationGranted = (lat: number, lng: number) => {
        setUserLocation({ latitude: lat, longitude: lng })
        setShowLocationPrompt(false)
        setLocationError(null)
    }

    const handlePost = async () => {
        const cantPost = !noteText.trim() || isCreatingPost || charCount > 140 || !userLocation

        if (cantPost) return

        setPostError(null)

        createPostMutation({ content: noteText.trim() } as any, {
            onSuccess: (result) => {
                if (result.success) {
                    setNoteText('')
                } else if (result.blocked) {
                    setPostError(result.message || 'Your post was not published.')
                }
            },
            onError: () => {
                setPostError('Something went wrong. Please try again.')
            },
        })
    }

    const needsLocation = !userLocation
    const canPost = !!userLocation
    const charCount = noteText.trim().length

    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
            <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
                <header className="mb-16 text-center">
                    <h1 className="text-balance font-display text-7xl font-bold tracking-tight text-primary md:text-8xl">
                        Yipyaps
                    </h1>
                    <p className="mt-3 text-balance text-lg text-muted-foreground md:text-xl">
                        {needsLocation ? 'Share quick notes with people nearby' : 'Yapping from your area'}
                    </p>
                </header>

                <LocationPromptModal
                    open={showLocationPrompt && needsLocation}
                    onLocationGranted={handleLocationGranted}
                    error={locationError}
                />

                {!needsLocation && (
                    <>
                        <div className="mb-12 flex justify-center">
                            <div className="flex items-center gap-2 rounded-full bg-secondary/20 px-6 py-3">
                                <span className="text-4xl font-bold text-secondary">
                                    {posts.length.toLocaleString()}
                                </span>
                                <span className="text-sm font-medium text-muted-foreground">posts nearby</span>
                            </div>
                        </div>

                        {canPost ? (
                            <Card className="mb-16 -rotate-1 border-2 border-secondary/30 bg-secondary/10 p-6 shadow-lg transition-transform hover:scale-[1.01] dark:bg-secondary/5">
                                <Textarea
                                    placeholder="Share a quick note..."
                                    value={noteText}
                                    onChange={(e) => {
                                        setNoteText(e.target.value)
                                        if (postError) setPostError(null)
                                    }}
                                    className="mb-4 min-h-[100px] resize-none border-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                                />
                                {postError && <p className="mb-4 text-sm font-medium text-destructive">{postError}</p>}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">{charCount} / 140</span>
                                    <Button
                                        onClick={handlePost}
                                        disabled={!noteText.trim() || charCount > 140 || isCreatingPost}
                                        className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
                                    >
                                        {isCreatingPost ? 'Moderating...' : 'Post'}
                                    </Button>
                                </div>
                            </Card>
                        ) : (
                            <Card className="mb-16 rotate-1 border-2 border-muted bg-muted/50 p-6 text-center shadow-md">
                                <p className="text-sm font-medium text-muted-foreground">Enable location to post</p>
                                <Button
                                    onClick={() => setShowLocationPrompt(true)}
                                    variant="outline"
                                    className="mt-4 font-medium"
                                >
                                    Enable Location
                                </Button>
                            </Card>
                        )}

                        <section className="space-y-8">
                            <h2 className="font-display text-2xl font-semibold text-foreground">Latest Yips</h2>
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
                                <p className="text-center text-muted-foreground">No yips nearby yet. Be the first!</p>
                            )}
                        </section>
                    </>
                )}

                {needsLocation && !showLocationPrompt && (
                    <div className="text-center">
                        <Button onClick={() => setShowLocationPrompt(true)} size="lg" className="font-medium">
                            Enable Location to Start
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
