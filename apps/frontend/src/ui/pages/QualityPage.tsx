import { useEffect, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { loadQualityDashboard } from '@/app/deps'
import { PageHeader } from '@/components/page-header'
import { PageError, PageLoading } from '@/components/page-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { QualityDashboard } from '@/entities/quality-metrics'
import { DataSources } from '@/ui/quality/data-sources'
import { DefectDensity } from '@/ui/quality/defect-density'
import { DoraCards } from '@/ui/quality/dora-cards'
import { DoraTrend } from '@/ui/quality/dora-trend'
import { comparisonText, periodText } from '@/ui/quality/labels'
import * as s from './QualityPage.styles'

export default function QualityPage() {
  const [dashboard, setDashboard] = useState<QualityDashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // An answer that arrives after the page was left must not set state.
    let shown = true
    loadQualityDashboard().then(
      (result) => { if (shown) setDashboard(result) },
      () => { if (shown) setError('โหลดข้อมูลคุณภาพระบบไม่สำเร็จ กรุณาลองใหม่') },
    )
    return () => { shown = false }
  }, [])

  if (!dashboard) return error ? <PageError message={error} /> : <PageLoading />

  const { periodStart, periodEnd } = dashboard

  return (
    <>
      <PageHeader title="คุณภาพระบบ" description="ตัวชี้วัด DORA และ Defect Density สำหรับรายงานผู้บริหาร" />
      <div className={s.stack()}>
        {dashboard.isSample && (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>ข้อมูลตัวอย่าง</AlertTitle>
            <AlertDescription>
              <p>ตัวเลขในหน้านี้เป็นข้อมูลตัวอย่างเพื่อสาธิตรูปแบบรายงาน ยังไม่ได้ดึงจากระบบจริง</p>
              <p>{periodText(periodStart, periodEnd)}</p>
            </AlertDescription>
          </Alert>
        )}

        <Section id="quality-dora" title="DORA Metrics">
          <DoraCards metrics={dashboard.dora} comparison={comparisonText(periodStart, periodEnd)} />
        </Section>
        <Section id="quality-trend" title="แนวโน้มรายสัปดาห์">
          <DoraTrend weeks={dashboard.weeks} />
        </Section>
        <Section id="quality-density" title="Defect Density รายโมดูล">
          <DefectDensity modules={dashboard.modules} overall={dashboard.overall} />
        </Section>
        <Section id="quality-sources" title="แหล่งข้อมูลเมื่อเชื่อมต่อระบบจริง">
          <DataSources />
        </Section>
      </div>
    </>
  )
}

function Section({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section aria-labelledby={id} className={s.section()}>
      <h2 id={id} className={s.heading()}>{title}</h2>
      {children}
    </section>
  )
}
