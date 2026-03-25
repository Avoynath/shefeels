export default function ChatSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex gap-6 p-6">
      {/* left nav skeleton */}
      <aside className="hidden md:block w-64">
        <div className="space-y-4">
          <div className="h-8 w-24 rounded-md bg-gray-700/40 animate-pulse" />
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-gray-700/20">
              <div className="w-10 h-10 rounded-full bg-gray-700/40 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-3/4 rounded bg-gray-700/40 animate-pulse mb-2" />
                <div className="h-2 w-1/2 rounded bg-gray-700/30 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* center chat skeleton */}
      <main className="flex-1 flex flex-col gap-4">
        <div className="h-10 w-1/3 rounded bg-gray-700/40 animate-pulse" />
        <div className="flex-1 bg-transparent">
          <div className="space-y-4">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className={`max-w-${i % 2 === 0 ? '2/3' : '1/3'} rounded-lg p-4 bg-gray-700/20`}> 
                <div className="h-3 w-3/4 rounded bg-gray-700/40 animate-pulse mb-2" />
                <div className="h-3 w-1/3 rounded bg-gray-700/30 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-12 rounded-md bg-gray-700/20 p-3 flex items-center">
          <div className="h-8 w-full rounded bg-gray-700/30 animate-pulse" />
        </div>
      </main>

      {/* right profile skeleton */}
      <aside className="hidden lg:block w-80">
        <div className="p-4 space-y-4">
          <div className="h-40 rounded bg-gray-700/30 animate-pulse" />
          <div className="h-5 w-3/4 rounded bg-gray-700/40 animate-pulse" />
          <div className="h-3 w-full rounded bg-gray-700/20 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-gray-700/20 animate-pulse" />
          <div className="h-10 rounded bg-gray-700/30 animate-pulse mt-4" />
        </div>
      </aside>
    </div>
  );
}
