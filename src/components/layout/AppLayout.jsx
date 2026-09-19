import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { Modal, Icon } from '../ui'
import { useData } from '../../context/DataContext'

const DESKTOP = '(min-width: 1024px)'

export default function AppLayout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { settings } = useData()

  // Navigating on a phone should always close the off-canvas rail.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const toggleNav = () => {
    if (window.matchMedia(DESKTOP).matches) setCollapsed((v) => !v)
    else setMobileOpen((v) => !v)
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <Topbar onToggleSidebar={toggleNav} />

      <div className="flex-1 flex min-h-0 relative">
        {mobileOpen && (
          <div
            className="fixed inset-0 top-16 bg-ink-900/40 z-30 lg:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onHelp={() => setHelpOpen(true)} />

        <main className="flex-1 min-w-0 overflow-y-auto scroll-thin bg-white">
          <div key={location.pathname} className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help Center" width="max-w-lg">
        <div className="space-y-5 text-[14px] text-ink-700 leading-6">
          <p>
            Need a hand with the portal? The GA Healthcare Training team is here Monday to Friday, 9am – 5pm
            Eastern.
          </p>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <Icon name="mail" className="w-[18px] h-[18px] text-brand-700 shrink-0" />
              <a className="link break-all" href={`mailto:${settings.supportEmail}`}>
                {settings.supportEmail}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="info" className="w-[18px] h-[18px] text-brand-700 shrink-0" />
              <span>{settings.supportPhone}</span>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="store" className="w-[18px] h-[18px] text-brand-700 shrink-0" />
              <a className="link break-all" href={settings.website} target="_blank" rel="noreferrer">
                {settings.website}
              </a>
            </li>
          </ul>
          <div className="rounded-md bg-brand-50 border border-brand-100 p-4">
            <p className="text-[13.5px] text-ink-900 font-medium mb-1">Accounts are created by administrators</p>
            <p className="text-[13px] text-ink-700">
              Students cannot register themselves. If a classmate needs access, ask the program office to add them
              from the Users page.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
