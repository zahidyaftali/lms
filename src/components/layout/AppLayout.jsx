import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { Modal, Icon } from '../ui'
import { useData } from '../../context/DataContext'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { settings } = useData()

  return (
    <div className="h-screen flex flex-col bg-white">
      <Topbar onToggleSidebar={() => setCollapsed((v) => !v)} />
      <div className="flex-1 flex min-h-0">
        <Sidebar collapsed={collapsed} onHelp={() => setHelpOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto scroll-thin bg-white">
          <div className="px-8 py-7 max-w-[1500px]">
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
              <Icon name="mail" className="w-[18px] h-[18px] text-brand-700" />
              <a className="link" href={`mailto:${settings.supportEmail}`}>
                {settings.supportEmail}
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="info" className="w-[18px] h-[18px] text-brand-700" />
              <span>{settings.supportPhone}</span>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="store" className="w-[18px] h-[18px] text-brand-700" />
              <a className="link" href={settings.website} target="_blank" rel="noreferrer">
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
