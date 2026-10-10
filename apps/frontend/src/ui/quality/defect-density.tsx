import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DensityRow, DensityTone, ModuleDensity } from '@/entities/quality-metrics'
import * as s from './defect-density.styles'
import { formatDensity, formatKloc, formatNumber, NOT_AVAILABLE, toneLabel } from './labels'

const UNIT = 'defect ต่อ KLOC'

// Modules are names, not a scale, so every bar takes the same colour; the bar length carries the figure.
const config = { density: { label: 'Defect Density', color: 'var(--chart-1)' } } satisfies ChartConfig

/** Defects per thousand lines of code: a bar per module, and the same figures as a table. */
export function DefectDensity({ modules, overall }: Readonly<{ modules: ModuleDensity[]; overall: DensityRow }>) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>จำนวน defect ต่อโค้ด 1,000 บรรทัด (KLOC) ของแต่ละโมดูล</CardDescription>
      </CardHeader>
      <CardContent className={s.layout()}>
        <div className={s.chartPane()}>
          <ChartContainer config={config} className={s.chart()}>
            <BarChart
              accessibilityLayer
              data={modules}
              layout="vertical"
              margin={{ top: 4, right: 44, bottom: 0, left: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                dataKey="density"
                domain={[0, 'auto']}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                tickFormatter={formatNumber}
              />
              <YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} tickMargin={4} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, items) => String(items[0]?.payload.name ?? '')}
                    formatter={(value) => (
                      <>
                        <span className={s.tooltipKey()} aria-hidden />
                        <span className={s.tooltipValue()}>{formatDensity(Number(value))}</span>
                        <span className={s.tooltipUnit()}>{UNIT}</span>
                      </>
                    )}
                  />
                }
              />
              <Bar
                dataKey="density"
                fill="var(--color-density)"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                // A density of 0 is a measured figure: it keeps a sliver and its label. No data draws nothing.
                minPointSize={(value) => (value === null || value === undefined ? 0 : 2)}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="density"
                  position="right"
                  offset={8}
                  formatter={(value) => (typeof value === 'number' ? formatDensity(value) : '')}
                  className={s.barLabel()}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className={s.tablePane()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>โมดูล</TableHead>
                <TableHead>ความเสี่ยง</TableHead>
                <TableHead className={s.number()}>KLOC</TableHead>
                <TableHead className={s.number()}>Defect</TableHead>
                <TableHead className={s.number()}>Defect Density</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.moduleId}>
                  <TableCell className={s.name()}>{module.name}</TableCell>
                  <TableCell>{module.risk ?? '-'}</TableCell>
                  <DensityCells row={module} />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>รวมทั้งระบบ</TableCell>
                <TableCell>-</TableCell>
                <DensityCells row={overall} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function DensityCells({ row }: Readonly<{ row: DensityRow }>) {
  return (
    <>
      <TableCell className={s.number()}>{formatKloc(row.kloc)}</TableCell>
      <TableCell className={s.number()}>{row.defects}</TableCell>
      <TableCell className={s.number()}>{formatDensity(row.density)}</TableCell>
      <TableCell>
        <Tone tone={row.tone} />
      </TableCell>
    </>
  )
}

function Tone({ tone }: Readonly<{ tone: DensityTone | null }>) {
  if (tone === null) return <span className={s.muted()}>{NOT_AVAILABLE}</span>
  return <StatusBadge tone={tone}>{toneLabel(tone)}</StatusBadge>
}
