import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId:
			process.env.CLOUDFLARE_DATABASE_ID ||
			'66dde7e9-fd63-44d4-a5bf-7a5044b826d8',
		token: process.env.CLOUDFLARE_D1_TOKEN!,
	},
})
