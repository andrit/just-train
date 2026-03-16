// ------------------------------------------------------------
// components/clients/ClientDrawer.tsx
//
// Context-aware drawer. Behavior changes based on props:
//   - client=null, open=true  → "Add Client" mode
//   - client=<obj>, open=true → "Edit Client" mode, pre-filled
//
// Used from:
//   - ClientsPage (Add Client button / Add Client card)
//   - ClientProfilePage (Edit button in profile header)
// ------------------------------------------------------------

import { useState }         from 'react'
import { Drawer }           from '@/components/ui/Drawer'
import { ClientForm }       from './ClientForm'
import { useCreateClient, useUpdateClient } from '@/lib/queries/clients'
import { useUXEvent }       from '@/hooks/useUXEvent'
import type { ClientResponse } from '@trainer-app/shared'
import type { CreateClientInput } from '@/lib/queries/clients'

interface ClientDrawerProps {
  open:     boolean
  onClose:  () => void
  /** Null = add mode. Populated = edit mode. */
  client?:  ClientResponse | null
  /** Called after a successful create or update */
  onSuccess?: (client: ClientResponse) => void
}

export function ClientDrawer({
  open, onClose, client, onSuccess,
}: ClientDrawerProps): React.JSX.Element {
  const isEditing = client != null
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const { fire }       = useUXEvent()

  const loading = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (data: CreateClientInput): void => {
    setError(null)

    if (isEditing) {
      updateMutation.mutate(
        { id: client.id, ...data },
        {
          onSuccess: (updated) => {
            fire('update', { entity: 'client', entityId: updated.id })
            onSuccess?.(updated)
            onClose()
          },
          onError: (err) => setError(err.message),
        },
      )
    } else {
      createMutation.mutate(data, {
        onSuccess: (created) => {
          fire('create', { entity: 'client', entityId: created.id })
          onSuccess?.(created)
          onClose()
        },
        onError: (err) => setError(err.message),
      })
    }
  }

  const handleClose = (): void => {
    if (!loading) {
      setError(null)
      onClose()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={isEditing ? `Edit — ${client.name}` : 'Add Client'}
    >
      <ClientForm
        client={client}
        loading={loading}
        error={error}
        onSubmit={handleSubmit}
        onCancel={handleClose}
      />
    </Drawer>
  )
}
