import 'dotenv/config'
import { db } from './index.js'
import { roles } from './schema.js'

async function seed() {
  await db.insert(roles).values([
    { name: 'user' },
    { name: 'admin' },
  ]).onConflictDoNothing()

  console.log('Roles seeded.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})