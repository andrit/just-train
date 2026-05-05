// ------------------------------------------------------------
// pages/MyTrainingPage.tsx
//
// Athlete "My Training" — resolves the self-client ID from
// GET /clients/self, then redirects to the full profile page.
// Avoids the trainerId ownership check that causes 404 when
// accessing /clients/:id directly.
// ------------------------------------------------------------

import { useEffect }                   from 'react'
import { useNavigate }                 from 'react-router-dom'
import { useSelfClient }               from '@/lib/queries/clients'
import { Spinner }                     from '@/components/ui/Spinner'

export default function MyTrainingPage(): React.JSX.Element {
  const { data: selfClient, isLoading } = useSelfClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (selfClient?.id) {
      navigate(`/clients/${selfClient.id}`, { replace: true })
    }
  }, [selfClient?.id, navigate])

  if (!isLoading && !selfClient) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Your training profile could not be found.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-sm text-command-blue hover:underline"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Spinner size="lg" className="text-command-blue" />
    </div>
  )
}
