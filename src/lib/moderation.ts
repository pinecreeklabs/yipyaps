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

const MODERATION_PROMPT = `You are a content moderator for a local community app where people post short messages about their city.

Your job is to check if the following post should be BLOCKED. Only block content that contains:
- Hate speech (racism, sexism, homophobia, religious hatred, etc.)
- NSFW/explicit sexual content
- Violent threats or calls for violence
- Slurs or derogatory language targeting groups

DO NOT block:
- General complaints or negative opinions (even harsh criticism is fine)
- Profanity that isn't hateful (casual swearing is ok)
- Political opinions
- Sarcasm or jokes (unless they contain hate speech)

Be lenient - when in doubt, allow the post. We want free expression, just not hate.

Always respond with JSON: {"allowed": true/false, "reason": "brief explanation of your decision"}

Post to moderate:`

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
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
		return { allowed: true, reason: 'Moderation error, allowed by default' }
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
