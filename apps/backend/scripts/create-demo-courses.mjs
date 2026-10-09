// Adds five future demo courses. Safe to run again; existing titles are left untouched.
const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Missing Supabase URL or service role key')

const api = `${url.replace(/\/$/, '')}/rest/v1`
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function request(path, init) {
  const response = await fetch(`${api}/${path}`, { ...init, headers: { ...headers, ...init?.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message ?? `Supabase request failed (${response.status})`)
  return body
}

const teachers = await request('profiles?select=id,full_name&role=eq.teacher&order=created_at.asc')
if (teachers.length === 0) throw new Error('No teacher profiles exist in Supabase')

const samples = [
  {
    title: 'คณิตศาสตร์ผ่านเกมและโจทย์ปริศนา',
    description: 'ฝึกคิดเลขและแก้โจทย์ผ่านเกมกลุ่ม เหมาะสำหรับผู้เรียนระดับประถมปลาย',
    starts_at: '2026-10-17T08:30:00+07:00', ends_at: '2026-10-17T10:30:00+07:00',
    capacity: 20, price: 1000,
  },
  {
    title: 'วาดภาพสีน้ำ: ธรรมชาติรอบตัว',
    description: 'เรียนรู้การลงสีน้ำและผสมสี พร้อมวาดภาพจากสิ่งรอบตัว',
    starts_at: '2026-10-17T08:30:00+07:00', ends_at: '2026-10-17T10:30:00+07:00',
    capacity: 12, price: 800,
  },
  {
    title: 'English Conversation & Mini Drama',
    description: 'ฝึกสนทนาภาษาอังกฤษผ่านบทบาทสมมติและละครสั้น',
    starts_at: '2026-10-17T13:00:00+07:00', ends_at: '2026-10-17T15:00:00+07:00',
    capacity: 16, price: 1500,
  },
  {
    title: 'เขียนโค้ดสร้างเกมด้วย Scratch',
    description: 'ทำความรู้จักแนวคิดการเขียนโปรแกรม แล้วสร้างเกมง่าย ๆ ด้วย Scratch',
    starts_at: '2026-10-24T09:00:00+07:00', ends_at: '2026-10-24T12:00:00+07:00',
    capacity: 18, price: 1200,
  },
  {
    title: 'ทดลองวิทย์: สะพานรับน้ำหนัก',
    description: 'ออกแบบและทดลองสร้างสะพานจากวัสดุใกล้ตัว เรียนรู้แรงและโครงสร้าง',
    starts_at: '2026-10-31T08:30:00+07:00', ends_at: '2026-10-31T11:30:00+07:00',
    capacity: 14, price: 950,
  },
]

const existing = await request('courses?select=id,title')
const titles = new Set(existing.map((course) => course.title))
const toCreate = samples.filter((course) => !titles.has(course.title))
if (toCreate.length === 0) {
  console.log('All five demo courses already exist; no rows changed.')
} else {
  const rows = toCreate.map((course, index) => ({
    ...course,
    teacher_id: teachers[index % teachers.length].id,
    starts_at: new Date(course.starts_at).toISOString(),
    ends_at: new Date(course.ends_at).toISOString(),
    approval_status: 'approved',
    registration_open: true,
  }))
  const created = await request('courses?select=id,title,teacher_id,starts_at,ends_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  console.log(`Created ${created.length} demo courses:`)
  for (const course of created) console.log(`- ${course.title}`)
}
