import type { ReactNode } from 'react'
import { actions, heading, root, subtitle, titleGroup } from './page-header.styles'

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
    <div className={root()}>
      <div className={titleGroup()}>
        <h1 className={heading()}>{title}</h1>
        {description && <p className={subtitle()}>{description}</p>}
      </div>
      {children && <div className={actions()}>{children}</div>}
    </div>
  )
}
