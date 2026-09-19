import { useNavigate } from 'react-router-dom'
import { Button, Icon } from '../../components/ui'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="card card-pad text-center py-20">
      <Icon name="search" className="w-9 h-9 mx-auto text-ink-400 mb-4" strokeWidth={1.4} />
      <h1 className="text-[22px] font-semibold">Page not found</h1>
      <p className="hint mt-2 mb-6">
        The page you were looking for does not exist, or your account cannot access it.
      </p>
      <Button onClick={() => navigate('/')}>Back to home</Button>
    </div>
  )
}
