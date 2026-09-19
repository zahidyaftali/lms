import { useAuth } from '../context/AuthContext'
import Dashboard from './admin/Dashboard'
import InstructorHome from './instructor/Home'
import LearnerHome from './learner/Home'

export default function Home() {
  const { view } = useAuth()
  if (view === 'admin') return <Dashboard />
  if (view === 'instructor') return <InstructorHome />
  return <LearnerHome />
}
