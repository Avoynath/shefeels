import { useTheme } from '../../contexts/ThemeContext';

export default function CreateCharacterSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className={`min-h-[calc(100vh-var(--header-h))] w-full px-4 py-6 ${isDark ? 'bg-[#0b0b0b] text-white' : 'bg-white text-slate-900'}`}>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl p-6 shadow-lg mb-6">
          <div className="h-8 w-1/3 rounded-full bg-gray-300/40 animate-pulse" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 h-64 rounded-lg bg-gray-300/30 animate-pulse" />
            <div className="col-span-2 space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-gray-300/30 animate-pulse" />
              <div className="h-3 w-full rounded bg-gray-300/20 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-300/20 animate-pulse" />
              <div className="h-10 w-40 rounded-full bg-gray-300/40 animate-pulse mt-6" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 bg-gray-100/50 animate-pulse h-40" />
          ))}
        </div>
      </div>
    </div>
  );
}
