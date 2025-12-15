import { generateObject } from 'ai'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { createWorkersAI } from 'workers-ai-provider'
import { z } from 'zod'
import type * as schema from '@/db/schema'
import { postEvals } from '@/db/schema'

const moderationSchema = z.object({
	allowed: z.boolean(),
	reason: z.string(),
})

export type ModerationResult = z.infer<typeof moderationSchema>

export interface LogEvalParams {
	db: DrizzleD1Database<typeof schema>
	postId: number
	result: ModerationResult
}

const MODERATION_PROMPT = `You are a lenient content moderator. Only block truly harmful content.

BLOCK (strict):
- Hate speech targeting race, religion, gender, sexuality
- Explicit sexual content
- Direct threats of violence
- Spam (repeated characters/words with no meaning like "asdfasdf" or "aaa")

ALLOW (be lenient):
- Profanity and swearing (fuck, shit, etc.)
- Harsh criticism of places, things, or ideas
- Negative opinions and complaints
- Political views
- Insults that aren't hate speech

When in doubt, ALLOW the post.

Post:`

export async function moderateContent(
	content: string,
	aiBinding: Ai | undefined,
): Promise<ModerationResult> {
	const contentPreview = content.substring(0, 50)

	if (!aiBinding) {
		console.log('[moderation] Skipped (no AI binding):', {
			content: contentPreview,
		})
		return { allowed: true, reason: 'Moderation skipped (no AI binding)' }
	}

	console.log('[moderation] Checking:', { content: contentPreview })

	try {
		const workersai = createWorkersAI({ binding: aiBinding })
		// biome-ignore lint/suspicious/noExplicitAny: workers-ai-provider doesn't export correct types
		const model = workersai('@cf/meta/llama-3.1-8b-instruct-fast' as any)

		const { object } = await generateObject({
			model,
			schema: moderationSchema,
			prompt: `${MODERATION_PROMPT}\n\n"${content}"`,
		})

		console.log('[moderation] Result:', {
			allowed: object.allowed,
			reason: object.reason,
		})

		return object
	} catch (error) {
		console.error(
			'[moderation] Error:',
			error instanceof Error ? error.message : error,
		)
		return { allowed: false, reason: 'Moderation service unavailable' }
	}
}

export async function logPostEval({
	db,
	postId,
	result,
}: LogEvalParams): Promise<void> {
	try {
		await db.insert(postEvals).values({
			postId,
			isAllowed: result.allowed,
			reason: result.reason,
		})
		console.log('[postEval] Logged:', {
			postId,
			isAllowed: result.allowed,
			reason: result.reason,
		})
	} catch (error) {
		console.error('[postEval] Failed to log:', error)
	}
}
