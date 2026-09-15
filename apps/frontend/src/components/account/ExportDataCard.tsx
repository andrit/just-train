// ------------------------------------------------------------
// components/account/ExportDataCard.tsx
//
// Preferences → Account → Download my data. One click, one JSON file of
// everything the account owns — the portability promise on /privacy.
// ------------------------------------------------------------

import { useExportData } from '@/lib/queries/account'
import { Button }        from '@/components/ui/Button'
import { toast }         from '@/store/toastStore'

export function ExportDataCard(): React.JSX.Element {
  const exportData = useExportData()

  const handleExport = async (): Promise<void> => {
    try {
      await exportData.mutateAsync()
      toast.success('Your data is downloading')
    } catch {
      toast.error('Could not build the export. Try again in a minute.')
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-200 mb-1">Download my data</p>
        <p className="text-xs text-gray-500">
          Everything in your account — sessions, sets, goals, snapshots, templates, challenges —
          as one JSON file. Photos and clips are included as links.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleExport} loading={exportData.isPending}>
        Download JSON
      </Button>
    </div>
  )
}
