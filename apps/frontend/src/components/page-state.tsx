import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle, type LucideIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

/** Shown before the session is known, when there is no page frame yet. */
export function FullPageLoading() {
  return (
    <output className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      กำลังโหลด…
    </output>
  )
}

/** Placeholder for a page whose data is still loading. */
export function PageLoading() {
  return (
    <div className="space-y-6">
      <output className="sr-only">กำลังโหลด…</output>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}

/** A page-level failure, e.g. the data could not be loaded. */
export function PageError({ message }: Readonly<{ message: string }>) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

/** Shown in place of a list or table that has nothing in it yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: Readonly<{
  icon: LucideIcon
  title: string
  description?: string
  children?: ReactNode
}>) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
