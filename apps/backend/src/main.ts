import { z } from 'zod'
import { createApp } from './app'

try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url))
} catch {
  // No file: fall through to the check below, which names what is missing.
}

const Config = z.object({
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FRONTEND_ORIGIN: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3001),
})

const parsed = Config.safeParse(process.env)
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  console.error(`API config error: missing or invalid ${missing}. Run \`task backend:up\` to write apps/backend/.env.local.`)
  process.exit(1)
}
const config = parsed.data

const app = createApp({ frontendOrigin: config.FRONTEND_ORIGIN })
app.listen(config.API_PORT, () => {
  console.log(`API listening on http://localhost:${config.API_PORT}`)
})
