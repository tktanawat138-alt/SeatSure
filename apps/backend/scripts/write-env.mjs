// Writes apps/frontend/.env.local and apps/backend/.env.local from the running local Supabase stack.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

let output
try {
  output = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  console.error('Could not read `supabase status`. Start the local stack first: task up')
  process.exit(1)
}

const status = {}
for (const line of output.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
  if (match) status[match[1]] = match[2]
}

for (const key of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  if (!status[key]) {
    console.error(`\`supabase status\` did not report ${key}.`)
    process.exit(1)
  }
}

writeFileSync(
  '../frontend/.env.local',
  [
    `VITE_SUPABASE_URL=${status.API_URL}`,
    `VITE_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    '# Used only by the seed script and the tests. Never exposed to the browser.',
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    '# The Express API the frontend calls.',
    'VITE_API_URL=http://localhost:3001',
    '',
  ].join('\n'),
)
console.log('Wrote apps/frontend/.env.local')

writeFileSync(
  '.env.local',
  [
    `SUPABASE_URL=${status.API_URL}`,
    `SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    '# Server only. Never expose to the browser or logs.',
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    'FRONTEND_ORIGIN=http://localhost:5173',
    'API_PORT=3001',
    '',
  ].join('\n'),
)
console.log('Wrote apps/backend/.env.local')
