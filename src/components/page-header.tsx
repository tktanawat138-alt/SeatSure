import type { ReactNode } from 'react'

/** Page title with an optional description and, on the right, optional actions. */
export function PageHeader({
  title,
  description,
  children,
}: Readonly<{
  title: string
  description?: string
  children?: ReactNode
}>) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
