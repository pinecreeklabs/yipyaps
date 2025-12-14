import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable(
	'posts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		content: text('content').notNull(),
		city: text('city').notNull(),
		latitude: text('latitude'),
		longitude: text('longitude'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
			() => new Date(),
		),
	},
	(table) => [index('posts_city_idx').on(table.city)],
)

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
