import Sidebar from '@/components/sidebar'
import { Toaster } from '@/components/toaster'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-auto">
        {children}
      </div>
      <Toaster />
    </div>
  )
}
