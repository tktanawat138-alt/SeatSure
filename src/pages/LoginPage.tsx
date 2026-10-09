import { useState, type FormEvent } from 'react'
import { errorText } from '../lib/format'
import { supabase } from '../lib/supabase'

// Accounts created by scripts/seed.mjs. Shown only when running the dev server.
const demoAccounts = [
  ...Array.from({ length: 10 }, (_, i) => ({
    label: `ผู้ปกครอง ${i + 1}`,
    email: `parent${i + 1}@seatsure.test`,
  })),
  { label: 'ครู', email: 'teacher1@seatsure.test' },
  { label: 'แอดมิน', email: 'admin@seatsure.test' },
]
const DEMO_PASSWORD = 'seatsure123'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: withEmail, password: withPassword })
    if (error) setError(errorText(error))
    setBusy(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void signIn(email, password)
  }

  return (
    <main className="login">
      <h1>SeatSure</h1>
      <p className="muted">จองคอร์สเรียนเสริม จ่ายแล้วได้ที่นั่งแน่นอน</p>

      <form className="card stack" onSubmit={submit}>
        <label>
          อีเมล
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          รหัสผ่าน
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          เข้าสู่ระบบ
        </button>
      </form>

      {import.meta.env.DEV && (
        <section className="card stack">
          <p className="muted">บัญชีสำหรับทดลอง</p>
          <div className="row">
            {demoAccounts.map((account) => (
              <button key={account.email} disabled={busy} onClick={() => signIn(account.email, DEMO_PASSWORD)}>
                {account.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
