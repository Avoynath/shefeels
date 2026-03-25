import { useTheme } from '../../contexts/ThemeContext';

export default function ProfileSkeleton() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className={`min-h-[calc(100vh-var(--header-h))] w-full px-6 py-8 ${isDark ? 'bg-[#0b0b0b] text-white' : 'bg-white text-slate-900'}`}>
      <div className="mx-auto max-w-4xl">
        <div className="flex gap-6 items-center mb-6">
          <div className="h-28 w-28 rounded-full bg-gray-300/30 animate-pulse" />
          <div className="flex-1">
            <div className="h-6 w-1/3 rounded-full bg-gray-300/40 animate-pulse" />
            <div className="mt-2 h-3 w-1/2 rounded bg-gray-300/30 animate-pulse" />
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-gray-100/50 animate-pulse h-60" />
      </div>
    </div>
  );
}
