export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 mb-4">
            <WaterIcon />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Grant Intelligence Workspace
          </h1>
          <p className="text-slate-400 text-sm mt-1">Water resource grant management</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {children}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} Grant Intelligence Workspace
        </p>
      </div>
    </div>
  )
}

function WaterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-7 h-7 text-white"
      aria-hidden="true"
    >
      <path d="M12 2C12 2 4 11.5 4 16a8 8 0 0 0 16 0C20 11.5 12 2 12 2Z" />
    </svg>
  )
}
