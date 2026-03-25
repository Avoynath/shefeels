import type { PropsWithChildren } from "react";
import Card from "../../components/Card";
import { useThemeStyles } from "../../utils/theme";
import { useTheme } from "../../contexts/ThemeContext";

type TocItem = { id: string; label: string };

type Props = PropsWithChildren<{
  title: string;
  updated?: string; // Effective date string
  toc?: TocItem[];  // Optional table of contents items
}>;

export default function GenericPolicy({ title, updated, toc, children }: Props) {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>{title}</h1>
          {updated && <p className={sub}>Effective Date: {updated}</p>}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 space-y-6">
          <Card>
            {/* Use primary text color for policy body so content appears white in dark mode
                and dark in light mode. Individual pages should avoid hard-coded color
                classes so they inherit this setting. */}
            <div className={`space-y-6 ${colors.text} text-sm`}>{children}</div>
          </Card>
        </main>

        <aside className="lg:col-span-4 space-y-6">
          {toc && toc.length > 0 && (
            <Card>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}>On this page</h3>
              </div>
              <nav className="mt-4 grid gap-2">
                {toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                    isDark 
                      ? "text-white/80 ring-white/10 hover:ring-white/25 hover:bg-white/5" 
                      : "text-gray-600 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50"
                  }`}>
                    {t.label}
                  </a>
                ))}
              </nav>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
