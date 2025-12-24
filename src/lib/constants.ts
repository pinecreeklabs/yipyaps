export function formatTimeAgo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export const NOTE_COLORS = [
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

export const ROTATIONS = [
    'rotate-[-2deg]',
    'rotate-[1.5deg]',
    'rotate-[-1deg]',
    'rotate-[2deg]',
    'rotate-[0.5deg]',
    'rotate-[-1.5deg]',
]

export function getRandomColor(postId: number): string {
    return NOTE_COLORS[postId % NOTE_COLORS.length]
}
