// Writes .env.local from the running local Supabase stack.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

let output
try {
  output = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
} catch {
  console.error('Could not read `supabase status`. Start the local stack first: npm run db:start')
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
  '.env.local',
  [
    `VITE_SUPABASE_URL=${status.API_URL}`,
    `VITE_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    '# Used only by the seed script and the tests. Never exposed to the browser.',
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    '',
  ].join('\n'),
)
console.log('Wrote .env.local')
