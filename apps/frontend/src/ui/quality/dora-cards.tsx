import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DoraMetric } from '@/entities/quality-metrics'
import * as s from './dora-cards.styles'
import { formatMetric, levelLabel, levelTone, metricMeaning, metricName, trendLabel } from './labels'

/** The four DORA figures for the later half of the period, each with its level and direction. */
export function DoraCards({ metrics, comparison }: Readonly<{ metrics: DoraMetric[]; comparison: string }>) {
  return (
    <div className={s.grid()}>
      {metrics.map((metric) => (
        <DoraCard key={metric.key} metric={metric} comparison={comparison} />
      ))}
    </div>
  )
}

function DoraCard({ metric, comparison }: Readonly<{ metric: DoraMetric; comparison: string }>) {
  const { text, unit } = formatMetric(metric.key, metric.value)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{metricName(metric.key)}</h3>
        </CardTitle>
        <CardDescription>{metricMeaning(metric.key)}</CardDescription>
      </CardHeader>
      <CardContent className={s.content()}>
        <p className={s.figure()}>
          <span className={s.value({ empty: metric.value === null })}>{text}</span>
          {unit && <span className={s.unit()}>{unit}</span>}
        </p>
        <div className={s.status()}>
          {metric.level && <StatusBadge tone={levelTone(metric.level)}>{levelLabel(metric.level)}</StatusBadge>}
          <Direction metric={metric} />
        </div>
        <p className={s.comparison()}>{metric.trend ? comparison : 'ไม่มีข้อมูลเปรียบเทียบ'}</p>
      </CardContent>
    </Card>
  )
}

/** The arrow shows which way the figure moved; the word and colour say whether that is good. */
function Direction({ metric }: Readonly<{ metric: DoraMetric }>) {
  const { trend, value, previous } = metric
  if (trend === null || value === null || previous === null) return null

  let Icon = Minus
  if (trend !== 'flat') Icon = value > previous ? ArrowUp : ArrowDown

  return (
    <span className={s.trend({ trend })}>
      <Icon className={s.trendIcon()} aria-hidden />
      {trendLabel(trend)}
    </span>
  )
}
