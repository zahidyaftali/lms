import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import Home from './pages/Home'
import Messages from './pages/shared/Messages'
import Profile from './pages/shared/Profile'
import NotFound from './pages/shared/NotFound'

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

import InstructorLearners from './pages/instructor/Learners'
import Grading from './pages/instructor/Grading'

import MyCourses from './pages/learner/MyCourses'
import CoursePlayer from './pages/learner/CoursePlayer'
import Catalog from './pages/learner/Catalog'
import Certificates from './pages/learner/Certificates'

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

/** Routes a role cannot reach fall back to its own home rather than a dead end. */
function RequireView({ allow, children }) {
  const { view } = useAuth()
  return allow.includes(view) ? children : <Navigate to="/" replace />
}

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />

      <Route
        path="/courses/:courseId"
        element={
          <RequireAuth>
            <RequireView allow={['admin', 'instructor']}>
              <CourseBuilder />
            </RequireView>
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="messages" element={<Messages />} />
        <Route path="profile" element={<Profile />} />

        <Route
          path="users"
          element={
            <RequireView allow={['admin']}>
              <Users />
            </RequireView>
          }
        />
        <Route
          path="users/:userId"
          element={
            <RequireView allow={['admin']}>
              <UserDetail />
            </RequireView>
          }
        />
        <Route
          path="courses"
          element={
            <RequireView allow={['admin', 'instructor']}>
              <Courses />
            </RequireView>
          }
        />
        <Route
          path="course-store"
          element={
            <RequireView allow={['admin']}>
              <CourseStore />
            </RequireView>
          }
        />
        <Route
          path="groups"
          element={
            <RequireView allow={['admin']}>
              <Groups />
            </RequireView>
          }
        />
        <Route
          path="branches"
          element={
            <RequireView allow={['admin']}>
              <Branches />
            </RequireView>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireView allow={['admin']}>
              <Notifications />
            </RequireView>
          }
        />
        <Route
          path="reports"
          element={
            <RequireView allow={['admin', 'instructor']}>
              <Reports />
            </RequireView>
          }
        />
        <Route
          path="settings"
          element={
            <RequireView allow={['admin']}>
              <Settings />
            </RequireView>
          }
        />

        <Route
          path="learners"
          element={
            <RequireView allow={['instructor']}>
              <InstructorLearners />
            </RequireView>
          }
        />
        <Route
          path="grading"
          element={
            <RequireView allow={['instructor', 'admin']}>
              <Grading />
            </RequireView>
          }
        />

        <Route
          path="my-courses"
          element={
            <RequireView allow={['learner']}>
              <MyCourses />
            </RequireView>
          }
        />
        <Route
          path="my-courses/:courseId"
          element={
            <RequireView allow={['learner']}>
              <CoursePlayer />
            </RequireView>
          }
        />
        <Route
          path="catalog"
          element={
            <RequireView allow={['learner']}>
              <Catalog />
            </RequireView>
          }
        />
        <Route
          path="certificates"
          element={
            <RequireView allow={['learner']}>
              <Certificates />
            </RequireView>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
