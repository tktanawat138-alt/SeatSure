import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DoraMetricKey, DoraWeek } from '@/entities/quality-metrics'
import * as s from './dora-trend.styles'
import { formatDate, formatNumber, formatShortDate, metricName, NOT_AVAILABLE, weeklyUnit, weeklyValue } from './labels'

const metricKeys: DoraMetricKey[] = ['deploymentFrequency', 'leadTime', 'changeFailureRate', 'timeToRestore']

/**
 * One small chart per metric. The four metrics have four different units, so they never share an axis.
 * A table with the same figures follows for readers who cannot use the charts.
 */
export function DoraTrend({ weeks }: Readonly<{ weeks: DoraWeek[] }>) {
  return (
    <>
      <div className={s.grid()}>
        {metricKeys.map((key) => (
          <TrendChart key={key} metric={key} weeks={weeks} />
        ))}
      </div>
      <WeeklyTable weeks={weeks} />
    </>
  )
}

function TrendChart({ metric, weeks }: Readonly<{ metric: DoraMetricKey; weeks: DoraWeek[] }>) {
  const unit = weeklyUnit(metric)
  // A week without a figure stays null, so the line breaks there instead of dropping to 0.
  const rows = weeks.map((week) => ({ weekStart: week.weekStart, value: weeklyValue(metric, week) }))
  const hasData = rows.some((row) => row.value !== null)
  const config = { value: { label: metricName(metric), color: 'var(--chart-1)' } } satisfies ChartConfig

  return (
    <Card className={s.card()}>
      <CardHeader>
        <CardTitle>
          <h3>{metricName(metric)}</h3>
        </CardTitle>
        <CardDescription>หน่วย: {unit}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className={s.chart()}>
            <LineChart accessibilityLayer data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="weekStart"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tickFormatter={formatShortDate}
              />
              <YAxis
                width={40}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                domain={[0, 'auto']}
                allowDecimals={metric !== 'deploymentFrequency'}
                tickFormatter={formatNumber}
                className={s.axisTick()}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(weekStart) => `สัปดาห์ที่เริ่ม ${formatDate(String(weekStart))}`}
                    formatter={(value) => (
                      <>
                        <span className={s.tooltipKey()} aria-hidden />
                        <span className={s.tooltipValue()}>{formatNumber(Number(value))}</span>
                        <span className={s.tooltipUnit()}>{unit}</span>
                      </>
                    )}
                  />
                }
              />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                connectNulls={false}
                dot={{ r: 4, fill: 'var(--color-value)', stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: 'var(--color-value)', stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className={s.empty()}>{NOT_AVAILABLE}</p>
        )}
      </CardContent>
    </Card>
  )
}

function WeeklyTable({ weeks }: Readonly<{ weeks: DoraWeek[] }>) {
  return (
    <div className={s.srOnly()}>
      <Table>
        <TableCaption>ตัวเลขรายสัปดาห์ของกราฟด้านบน</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">สัปดาห์ที่เริ่ม</TableHead>
            {metricKeys.map((metric) => (
              <TableHead key={metric} scope="col">
                {metricName(metric)} ({weeklyUnit(metric)})
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.map((week) => (
            <TableRow key={week.weekStart}>
              <TableHead scope="row">{formatDate(week.weekStart)}</TableHead>
              {metricKeys.map((metric) => {
                const value = weeklyValue(metric, week)
                return <TableCell key={metric}>{value === null ? NOT_AVAILABLE : formatNumber(value)}</TableCell>
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
