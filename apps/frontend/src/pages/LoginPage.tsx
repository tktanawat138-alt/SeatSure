import { useState, type SubmitEvent } from 'react'
import { CircleAlert, CreditCard, FlaskConical, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { errorText } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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

const isParent = (account: { email: string }) => account.email.startsWith('parent')
const demoGroups = [
  // The ten parents run down two columns: 1 to 5 on the left, 6 to 10 on the right.
  { label: 'ผู้ปกครอง', layout: 'grid-flow-col grid-rows-5', accounts: demoAccounts.filter(isParent) },
  { label: 'ครูและแอดมิน', layout: '', accounts: demoAccounts.filter((account) => !isParent(account)) },
]

const promises: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: 'ไม่เกิน', text: 'ไม่รับจองเกินจำนวนที่นั่ง' },
  { icon: CreditCard, title: 'ไม่ซ้ำ', text: 'ไม่เก็บเงินซ้ำ' },
  { icon: ShieldCheck, title: 'ไม่หลุด', text: 'จ่ายแล้วได้ที่นั่ง หรือได้เงินคืน' },
]

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-between gap-12 overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.16)_1px,transparent_0)] bg-size-[24px_24px] [mask-image:linear-gradient(to_bottom_right,black,transparent_70%)]"
      />

      <Logo inverted className="relative text-lg" />

      <div className="relative max-w-md space-y-10">
        <p className="text-3xl leading-normal font-semibold xl:text-4xl xl:leading-normal">
          <span className="block">จ่ายแล้วต้องได้ที่นั่ง</span>{' '}
          <span className="block text-primary-foreground/70">ไม่เกิน ไม่ซ้ำ ไม่หลุด</span>
        </p>
        <ul className="space-y-5">
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-primary-foreground/75">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-primary-foreground/70">ระบบจองคอร์สเรียนเสริมของโรงเรียน</p>
    </aside>
  )
}

function DemoAccounts({ busy, onPick }: Readonly<{ busy: boolean; onPick: (email: string) => void }>) {
  return (
    <section aria-labelledby="demo-accounts" className="space-y-3 rounded-xl border border-dashed bg-background px-6 py-5">
      <div className="space-y-0.5">
        <h2 id="demo-accounts" className="flex items-center gap-1.5 text-sm font-medium">
          <FlaskConical className="size-4 text-muted-foreground" aria-hidden />
          บัญชีสำหรับทดลอง
        </h2>
        <p className="text-xs text-muted-foreground">กดชื่อบัญชีเพื่อเข้าสู่ระบบทันที</p>
      </div>

      {demoGroups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className={cn('grid grid-cols-2 gap-1.5', group.layout)}>
            {group.accounts.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onPick(account.email)}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

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

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(email, password)
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />

      <main className="flex flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Logo className="justify-center text-lg lg:hidden" />

          <Card className="gap-6 py-6">
            <CardHeader className="px-6">
              <CardTitle className="text-xl">
                <h1>เข้าสู่ระบบ</h1>
              </CardTitle>
              <CardDescription>จองคอร์สเรียนเสริม จ่ายแล้วได้ที่นั่งแน่นอน</CardDescription>
            </CardHeader>
            <CardContent className="px-6">
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">อีเมล</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="h-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">รหัสผ่าน</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="h-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  {error && (
                    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                      <CircleAlert aria-hidden />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy}>
                    {busy && <Spinner data-icon="inline-start" aria-hidden />}
                    เข้าสู่ระบบ
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {import.meta.env.DEV && (
            <DemoAccounts busy={busy} onPick={(accountEmail) => void signIn(accountEmail, DEMO_PASSWORD)} />
          )}
        </div>
      </main>
    </div>
  )
}
