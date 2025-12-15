import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { getDb, posts } from '@/db'
import { coordsToCellId, getCellIdWithNeighbors } from './geo'
import { resolveCity } from './geocoding'
import { logPostEval, moderateContent } from './moderation'
import type { CreatePostInput, GetPostsInput } from './types'

async function getEnvAndDb() {
	const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
	return { env, db: getDb(env.DB) }
}

export const getPosts = createServerFn({ method: 'GET' })
	.inputValidator((data?: GetPostsInput) => data)
	.handler(async ({ data }) => {
		const { db } = await getEnvAndDb()

		// GPS required to view posts
		if (!data?.userLat || !data?.userLng) {
			return []
		}

		const { userLat, userLng } = data

		// Get cell IDs to query (center + neighbors)
		const cellIds = getCellIdWithNeighbors(userLat, userLng)

		// 24 hours ago
		const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

		try {
			const result = await db
				.select()
				.from(posts)
				.where(
					and(
						inArray(posts.cellId, cellIds),
						eq(posts.isVisible, true),
						gt(posts.createdAt, twentyFourHoursAgo),
					),
				)
				.orderBy(desc(posts.createdAt))
				.all()

			// Strip exact coordinates before returning
			return result.map((post) => ({
				...post,
				latitude: null,
				longitude: null,
			}))
		} catch (error) {
			console.error('[getPosts] Error:', error)
			throw new Error('Failed to load posts. Please try again.')
		}
	})

export const createPost = createServerFn({ method: 'POST' })
	.inputValidator((data: CreatePostInput) => {
		if (!data.content?.trim()) {
			throw new Error('Post content is required')
		}
		if (
			typeof data.latitude !== 'number' ||
			typeof data.longitude !== 'number'
		) {
			throw new Error('Location is required to post')
		}
		if (
			data.latitude < -90 ||
			data.latitude > 90 ||
			data.longitude < -180 ||
			data.longitude > 180
		) {
			throw new Error('Invalid coordinates')
		}
		return data
	})
	.handler(async ({ data }) => {
		const { env, db } = await getEnvAndDb()
		const { content, latitude, longitude } = data

		const trimmedContent = content.trim()

		// Compute S2 cell ID from coordinates
		const cellId = coordsToCellId(latitude, longitude)

		// Resolve city name (non-blocking, for future display)
		const { city } = await resolveCity(
			latitude,
			longitude,
			env.GOOGLE_MAPS_API_KEY,
		)

		// Content moderation
		const moderation = await moderateContent(trimmedContent, env.AI)

		try {
			const result = await db
				.insert(posts)
				.values({
					content: trimmedContent,
					cellId,
					city,
					latitude: String(latitude),
					longitude: String(longitude),
					isVisible: moderation.allowed,
				})
				.returning()

			const postId = result[0]?.id
			if (postId) {
				await logPostEval({ db, postId, result: moderation })
			}

			console.log('[createPost]', moderation.allowed ? 'Published' : 'Hidden', {
				postId,
				cellId,
				city,
			})

			if (!moderation.allowed) {
				throw new Error(
					moderation.reason ||
						'Your post contains content that violates our community guidelines.',
				)
			}

			return result
		} catch (error) {
			// Re-throw moderation errors
			if (
				error instanceof Error &&
				error.message.includes('community guidelines')
			) {
				throw error
			}
			console.error('[createPost] DB Error:', error)
			throw new Error('Failed to create post. Please try again.')
		}
	})
