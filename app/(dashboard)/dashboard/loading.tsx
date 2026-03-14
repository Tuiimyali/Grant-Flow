import PageHeader from '@/components/page-header'

function Shimmer({ className }: { className: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Loading…" />

      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4"
            >
              <Shimmer className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 pt-0.5">
                <Shimmer className="h-3 w-20" />
                <Shimmer className="h-7 w-14" />
                <Shimmer className="h-2.5 w-24 bg-slate-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-5 w-full rounded-full" />
          <div className="flex gap-4 pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-3 w-20 bg-slate-100" />
            ))}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Deadlines list */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <Shimmer className="h-4 w-40 mb-4" />
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="flex-1 space-y-1.5">
                    <Shimmer className="h-4 w-52" />
                    <Shimmer className="h-3 w-32 bg-slate-100" />
                  </div>
                  <Shimmer className="h-5 w-16 rounded-full bg-slate-100" />
                  <Shimmer className="h-5 w-10 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats panel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <Shimmer className="h-4 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Shimmer className="h-3 w-24 bg-slate-100" />
                <Shimmer className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
