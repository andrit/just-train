/**
 * @trainer-app/ui — component barrel
 *
 * Import from here in all application code:
 *   import { Button, Modal, Input } from '@/components/ui'
 *
 * Each component lives in its own file so:
 *   - Stories import directly (no circular barrel issues)
 *   - Tree-shaking removes unused components from the bundle
 *   - Types are co-located with their component
 */

export { Button }        from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Badge }         from './Badge'
export type { BadgeProps, BadgeVariant } from './Badge'

export { Spinner }       from './Spinner'
export type { SpinnerProps, SpinnerSize } from './Spinner'

export { EmptyState }    from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { Input }         from './Input'
export type { InputProps } from './Input'

export { TextArea }      from './TextArea'
export type { TextAreaProps } from './TextArea'

export { Select }        from './Select'
export type { SelectProps, SelectOption } from './Select'

export { Modal }         from './Modal'
export type { ModalProps, ModalSize } from './Modal'

export { Drawer }        from './Drawer'
export type { DrawerProps } from './Drawer'

export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'
