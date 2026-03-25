export default function DefaultSkeleton() {
  return (
    <div className="min-h-[calc(100vh-64px)] p-6 space-y-6">
      <div className="h-8 w-1/3 rounded bg-gray-700/40 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => (
          <div key={i} className="p-4 rounded bg-gray-700/20">
            <div className="h-4 w-3/4 rounded bg-gray-700/40 animate-pulse mb-4" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-gray-700/30 animate-pulse" />
              <div className="h-3 rounded bg-gray-700/30 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-gray-700/30 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
