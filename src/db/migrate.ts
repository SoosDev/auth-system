import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import 'dotenv/config'

async function runMigrations() {
  const connection = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(connection)

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('Migrations complete.')

  await connection.end()
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})