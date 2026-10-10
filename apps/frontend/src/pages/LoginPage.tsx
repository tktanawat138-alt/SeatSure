import { useState, type SubmitEvent } from 'react'
import { CircleAlert, CreditCard, FlaskConical, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { errorText } from '@/lib/format'
import { signIn as signInWithPassword } from '@/app/deps'
import * as styles from './LoginPage.styles'
import type { DemoGridProps } from './LoginPage.styles'

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
const demoGroups: { label: string; flow: DemoGridProps['flow']; accounts: typeof demoAccounts }[] = [
  // The ten parents run down two columns: 1 to 5 on the left, 6 to 10 on the right.
  { label: 'ผู้ปกครอง', flow: 'columns', accounts: demoAccounts.filter(isParent) },
  { label: 'ครูและแอดมิน', flow: 'rows', accounts: demoAccounts.filter((account) => !isParent(account)) },
]

const promises: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: 'ไม่เกิน', text: 'ไม่รับจองเกินจำนวนที่นั่ง' },
  { icon: CreditCard, title: 'ไม่ซ้ำ', text: 'ไม่เก็บเงินซ้ำ' },
  { icon: ShieldCheck, title: 'ไม่หลุด', text: 'จ่ายแล้วได้ที่นั่ง หรือได้เงินคืน' },
]

function BrandPanel() {
  return (
    <aside className={styles.brandPanel()}>
      <div
        aria-hidden
        className={styles.brandDots()}
      />

      <Logo inverted className={styles.brandLogo()} />

      <div className={styles.brandBody()}>
        <p className={styles.headline()}>
          <span className={styles.headlineLine()}>จ่ายแล้วต้องได้ที่นั่ง</span>{' '}
          <span className={styles.headlineLine({ muted: true })}>ไม่เกิน ไม่ซ้ำ ไม่หลุด</span>
        </p>
        <ul className={styles.promiseList()}>
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.promiseItem()}>
              <span className={styles.promiseIcon()}>
                <Icon className={styles.promiseIconSvg()} aria-hidden />
              </span>
              <div>
                <p className={styles.promiseTitle()}>{title}</p>
                <p className={styles.promiseText()}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.brandFooter()}>ระบบจองคอร์สเรียนเสริมของโรงเรียน</p>
    </aside>
  )
}

function DemoAccounts({ busy, onPick }: Readonly<{ busy: boolean; onPick: (email: string) => void }>) {
  return (
    <section aria-labelledby="demo-accounts" className={styles.demoSection()}>
      <div className={styles.demoHeader()}>
        <h2 id="demo-accounts" className={styles.demoTitle()}>
          <FlaskConical className={styles.demoTitleIcon()} aria-hidden />
          บัญชีสำหรับทดลอง
        </h2>
        <p className={styles.demoHint()}>กดชื่อบัญชีเพื่อเข้าสู่ระบบทันที</p>
      </div>

      {demoGroups.map((group) => (
        <div key={group.label} className={styles.demoGroup()}>
          <p className={styles.demoGroupLabel()}>{group.label}</p>
          <div className={styles.demoGrid({ flow: group.flow })}>
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
    try {
      await signInWithPassword(withEmail, withPassword)
    } catch (error) {
      setError(errorText(error instanceof Error ? error : { message: 'network_error' }))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(email, password)
  }

  return (
    <div className={styles.page()}>
      <div className={styles.themeCorner()}>
        <ThemeToggle />
      </div>
      <BrandPanel />

      <main className={styles.main()}>
        <div className={styles.column()}>
          <Logo className={styles.mobileLogo()} />

          <Card className={styles.card()}>
            <CardHeader className={styles.cardHeader()}>
              <CardTitle className={styles.cardTitle()}>
                <h1>เข้าสู่ระบบ</h1>
              </CardTitle>
              <CardDescription>จองคอร์สเรียนเสริม จ่ายแล้วได้ที่นั่งแน่นอน</CardDescription>
            </CardHeader>
            <CardContent className={styles.cardContent()}>
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">อีเมล</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={styles.input()}
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
                      className={styles.input()}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  {error && (
                    <Alert variant="destructive" className={styles.errorAlert()}>
                      <CircleAlert aria-hidden />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" size="lg" className={styles.submitButton()} disabled={busy} aria-busy={busy}>
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
