import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable(
	'posts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		content: text('content').notNull(),
		cellId: text('cell_id'), // S2 cell ID for location-based queries
		city: text('city'), // Optional, for display only
		latitude: text('latitude'),
		longitude: text('longitude'),
		isVisible: integer('is_visible', { mode: 'boolean' })
			.notNull()
			.default(true),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
			() => new Date(),
		),
	},
	(table) => [
		index('posts_cell_id_idx').on(table.cellId),
		index('posts_created_at_idx').on(table.createdAt),
		index('posts_city_idx').on(table.city), // Keep for backwards compat
	],
)

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert

export const postEvals = sqliteTable('post_evals', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	postId: integer('post_id')
		.notNull()
		.references(() => posts.id),
	isAllowed: integer('is_allowed', { mode: 'boolean' }).notNull(),
	reason: text('reason'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
})

export type PostEval = typeof postEvals.$inferSelect
export type NewPostEval = typeof postEvals.$inferInsert
