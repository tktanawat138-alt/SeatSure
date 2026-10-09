// Creates the demo accounts and sample courses. Safe to run more than once.
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Local: run `task up`. Cloud: fill them in .env.production.local.',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// The well-known demo password is only for the local stack. A database that is
// reachable from the internet must be seeded with a password of your own.
const isLocal = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)
if (!isLocal && !process.env.SEED_PASSWORD) {
  console.error('This is not the local database. Set SEED_PASSWORD in the env file before seeding it.')
  process.exit(1)
}
const PASSWORD = process.env.SEED_PASSWORD || 'seatsure123'

const accounts = [
  { email: 'admin@seatsure.test', fullName: 'คุณวิภา', role: 'admin' },
  { email: 'teacher1@seatsure.test', fullName: 'ครูสมศรี', role: 'teacher' },
  { email: 'teacher2@seatsure.test', fullName: 'ครูวิชัย', role: 'teacher' },
  { email: 'parent1@seatsure.test', fullName: 'น้องมะลิ', role: 'parent' },
  { email: 'parent2@seatsure.test', fullName: 'น้องภูผา', role: 'parent' },
  { email: 'parent3@seatsure.test', fullName: 'น้องข้าวหอม', role: 'parent' },
  { email: 'parent4@seatsure.test', fullName: 'น้องต้นกล้า', role: 'parent' },
  { email: 'parent5@seatsure.test', fullName: 'น้องใบเตย', role: 'parent' },
  { email: 'parent6@seatsure.test', fullName: 'น้องน้ำใส', role: 'parent' },
  { email: 'parent7@seatsure.test', fullName: 'น้องอิ่มบุญ', role: 'parent' },
  { email: 'parent8@seatsure.test', fullName: 'น้องปันปัน', role: 'parent' },
  { email: 'parent9@seatsure.test', fullName: 'น้องเมฆ', role: 'parent' },
  { email: 'parent10@seatsure.test', fullName: 'น้องพอใจ', role: 'parent' },
]

const courses = [
  {
    title: 'คณิตศาสตร์เสริม ม.1',
    description: 'ทบทวนพื้นฐานและฝึกโจทย์ ทุกวันเสาร์ 9:00–12:00',
    teacher: 'teacher1@seatsure.test',
    capacity: 20,
    price: 2500,
  },
  {
    title: 'ภาษาอังกฤษสนทนา',
    description: 'ฝึกพูดกลุ่มเล็ก ทุกวันอาทิตย์ 13:00–15:00',
    teacher: 'teacher2@seatsure.test',
    capacity: 15,
    price: 3000,
  },
  {
    title: 'ฟิสิกส์โอลิมปิก',
    description: 'กลุ่มเข้มข้น รับจำนวนจำกัด',
    teacher: 'teacher1@seatsure.test',
    capacity: 2,
    price: 4500,
  },
]

const grades = [
  { course: 'คณิตศาสตร์เสริม ม.1', student: 'parent1@seatsure.test', grade: 'A' },
  { course: 'คณิตศาสตร์เสริม ม.1', student: 'parent2@seatsure.test', grade: 'B+' },
]

function check(error, what) {
  if (error) {
    console.error(`${what}: ${error.message}`)
    process.exit(1)
  }
}

const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
check(listError, 'list users')

const userIds = {}
for (const account of accounts) {
  let user = existing.users.find((u) => u.email === account.email)
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    })
    check(error, `create ${account.email}`)
    user = data.user
  }
  userIds[account.email] = user.id

  const { error } = await supabase
    .from('profiles')
    .update({ role: account.role, full_name: account.fullName })
    .eq('id', user.id)
  check(error, `set role for ${account.email}`)
}

const courseIds = {}
for (const course of courses) {
  const { data: found, error: findError } = await supabase
    .from('courses')
    .select('id')
    .eq('title', course.title)
    .limit(1)
  check(findError, `find course ${course.title}`)

  if (found.length > 0) {
    courseIds[course.title] = found[0].id
    continue
  }
  const { data, error } = await supabase
    .from('courses')
    .insert({
      title: course.title,
      description: course.description,
      teacher_id: userIds[course.teacher],
      capacity: course.capacity,
      price: course.price,
    })
    .select('id')
    .single()
  check(error, `create course ${course.title}`)
  courseIds[course.title] = data.id
}

const { error: gradeError } = await supabase.from('grades').upsert(
  grades.map((g) => ({
    course_id: courseIds[g.course],
    student_id: userIds[g.student],
    grade: g.grade,
  })),
  { onConflict: 'course_id,student_id' },
)
check(gradeError, 'seed grades')

console.log(`Seeded ${accounts.length} accounts and ${courses.length} courses.`)
console.log(`Sign in with any of these (password: ${PASSWORD}):`)
for (const account of accounts) console.log(`  ${account.role.padEnd(7)} ${account.email}`)
