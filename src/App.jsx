import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { useAuth } from './context/AuthContext'
import { useData } from './context/DataContext'
import { useToast } from './context/ToastContext'

import Login from './pages/Login'
import Signup from './pages/Signup'
import Gates from './pages/Gates'
import Home from './pages/Home'
import Messages from './pages/shared/Messages'
import Profile from './pages/shared/Profile'
import NotFound from './pages/shared/NotFound'
import PublicCourse from './pages/shared/PublicCourse'
import { PublicCatalog, PublicHome, VerifyCertificate, VerifyEmail } from './pages/public/PublicPages'

import Users from './pages/admin/Users'
import UserDetail from './pages/admin/UserDetail'
import Courses from './pages/admin/Courses'
import CourseBuilder from './pages/admin/CourseBuilder'
import CourseStore from './pages/admin/CourseStore'
import Groups from './pages/admin/Groups'
import Branches from './pages/admin/Branches'
import Notifications from './pages/admin/Notifications'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'
import LearningPaths from './pages/admin/LearningPaths'
import Automations from './pages/admin/Automations'
import Skills from './pages/admin/Skills'
import Subscription from './pages/admin/Subscription'

import InstructorLearners from './pages/instructor/Learners'
import Grading from './pages/instructor/Grading'

import MyCourses from './pages/learner/MyCourses'
import CoursePlayer from './pages/learner/CoursePlayer'
import Catalog from './pages/learner/Catalog'
import Certificates from './pages/learner/Certificates'
import MyPaths from './pages/learner/MyPaths'
import MySkills from './pages/learner/MySkills'
import Achievements from './pages/learner/Achievements'

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

/** Routes a role cannot reach fall back to its own home rather than a dead end. */
function RequireView({ allow, children }) {
  const { view } = useAuth()
  return allow.includes(view) ? children : <Navigate to="/" replace />
}

/**
 * Signed in: the portal. Signed out: the custom homepage at "/" when it is
 * switched on in Account & Settings → Portal, otherwise the sign-in page.
 */
function Shell() {
  const { isAuthenticated } = useAuth()
  const { settings } = useData()
  const location = useLocation()
  if (isAuthenticated) return <AppLayout />
  if (location.pathname === '/' && settings.homepage?.custom) return <PublicHome />
  return <Navigate to="/login" replace />
}

const THEMES = { 'Navy & gold': 'navy', Light: 'light', 'High contrast': 'contrast' }
const LANG = { Spanish: 'es', French: 'fr' }

/** Account & Settings → Portal: site name, description, favicon, theme and language reach the browser here. */
function usePortalIdentity(settings) {
  const { favicon, theme, siteName, siteDescription, language } = settings

  useEffect(() => {
    let link = document.querySelector('link[rel="icon"]')
    if (!favicon) {
      link?.remove()
      return
    }
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = favicon
  }, [favicon])

  useEffect(() => {
    const slug = THEMES[theme]
    if (slug) document.documentElement.dataset.theme = slug
    else delete document.documentElement.dataset.theme
  }, [theme])

  useEffect(() => {
    if (siteName) document.title = siteName
    document.querySelector('meta[name="description"]')?.setAttribute('content', siteDescription || '')
    document.documentElement.lang = LANG[language] || 'en'
  }, [siteName, siteDescription, language])
}

/** Shows what the server said when it refused a change (for example, a password that breaks the rules). */
function ServerNotices() {
  const { notice, actions } = useData()
  const toast = useToast()
  useEffect(() => {
    if (!notice) return
    toast(notice.text, notice.tone || 'error')
    actions.clearNotice()
  }, [notice, toast, actions])
  return null
}

const admin = (page) => <RequireView allow={['admin']}>{page}</RequireView>
const staff = (page) => <RequireView allow={['admin', 'instructor']}>{page}</RequireView>
const learner = (page) => <RequireView allow={['learner']}>{page}</RequireView>

export default function App() {
  const { isAuthenticated, gate } = useAuth()
  const { settings } = useData()
  usePortalIdentity(settings)
  const gated = isAuthenticated && !!gate

  return (
    <>
      <ServerNotices />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/verify/:code" element={<VerifyCertificate />} />
        <Route path="/explore" element={<PublicCatalog />} />
        {/* The custom homepage, whoever is looking: lets an administrator preview it while signed in. */}
        <Route path="/welcome" element={<PublicHome />} />

        {/* Courses with public sharing on; no account needed. */}
        <Route path="/share/:courseId" element={<PublicCourse />} />

        {gated ? (
          // Two-factor set-up, a new password or the terms of service come before anything else.
          <Route path="*" element={<Gates />} />
        ) : (
          <>
            <Route
              path="/courses/:courseId"
              element={
                <RequireAuth>
                  {staff(<CourseBuilder />)}
                </RequireAuth>
              }
            />

            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="messages" element={<Messages />} />
              <Route path="profile" element={<Profile />} />

              <Route path="users" element={admin(<Users />)} />
              <Route path="users/:userId" element={admin(<UserDetail />)} />
              <Route path="courses" element={staff(<Courses />)} />
              <Route path="course-store" element={admin(<CourseStore />)} />
              <Route path="groups" element={admin(<Groups />)} />
              <Route path="branches" element={admin(<Branches />)} />
              <Route path="notifications" element={admin(<Notifications />)} />
              <Route path="reports" element={staff(<Reports />)} />
              <Route path="settings" element={admin(<Settings />)} />
              <Route path="learning-paths" element={admin(<LearningPaths />)} />
              <Route path="automations" element={admin(<Automations />)} />
              <Route path="skills" element={admin(<Skills />)} />
              <Route path="subscription" element={admin(<Subscription />)} />

              <Route path="learners" element={<RequireView allow={['instructor']}><InstructorLearners /></RequireView>} />
              <Route path="grading" element={staff(<Grading />)} />

              <Route path="my-courses" element={learner(<MyCourses />)} />
              <Route path="my-courses/:courseId" element={learner(<CoursePlayer />)} />
              <Route path="catalog" element={learner(<Catalog />)} />
              <Route path="certificates" element={learner(<Certificates />)} />
              <Route path="my-paths" element={learner(<MyPaths />)} />
              <Route path="my-skills" element={learner(<MySkills />)} />
              <Route path="achievements" element={learner(<Achievements />)} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </>
        )}
      </Routes>
    </>
  )
}
