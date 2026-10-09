import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle, type LucideIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  empty,
  emptyDescription,
  emptyIcon,
  emptyIconWrap,
  emptyText,
  emptyTitle,
  fullPage,
  loading,
  loadingHeader,
  skeletonCard,
  skeletonGrid,
  skeletonSubtitle,
  skeletonTitle,
  spinner,
  srOnly,
} from './page-state.styles'

/** Shown before the session is known, when there is no page frame yet. */
export function FullPageLoading() {
  return (
    <output className={fullPage()}>
      <LoaderCircle className={spinner()} aria-hidden />
      กำลังโหลด…
    </output>
  )
}

/** Placeholder for a page whose data is still loading. */
export function PageLoading() {
  return (
    <div className={loading()}>
      <output className={srOnly()}>กำลังโหลด…</output>
      <div className={loadingHeader()}>
        <Skeleton className={skeletonTitle()} />
        <Skeleton className={skeletonSubtitle()} />
      </div>
      <div className={skeletonGrid()}>
        <Skeleton className={skeletonCard()} />
        <Skeleton className={skeletonCard()} />
        <Skeleton className={skeletonCard()} />
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
    <div className={empty()}>
      <span className={emptyIconWrap()}>
        <Icon className={emptyIcon()} aria-hidden />
      </span>
      <div className={emptyText()}>
        <p className={emptyTitle()}>{title}</p>
        {description && <p className={emptyDescription()}>{description}</p>}
      </div>
      {children}
    </div>
  )
}
