import { useEffect, useMemo, useRef, useState } from "react";

// Local type definitions (shared shape with FilterMenu)
export type FilterOption = { id: string; label: string };
export type FilterSection = {
  id: string;
  label: string;
  type: "single" | "multi";
  options: FilterOption[];
};

export interface FilterMenuProps {
  open?: boolean;
  sections: FilterSection[];
  value: Record<string, string | string[]>;
  onChange: (v: Record<string, string | string[]>) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  align?: "left" | "right";
}

// Anchored dropdown menu that opens downward under its parent (parent must be relative)
export default function FilterMenu({
  open = true,
  sections,
  value,
  onChange,
  onApply,
  onClear,
  onClose,
  align = "right",
}: FilterMenuProps) {
  const [activeId, setActiveId] = useState<string>(() => sections?.[0]?.id || "");
  const active = useMemo(() => sections?.find((s) => s.id === activeId) || sections?.[0], [sections, activeId]);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = ref.current; if (!el) return;
      if (!el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocMouseDown); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const setSingle = (sectionId: string, optionId: string) => {
    onChange({ ...value, [sectionId]: optionId });
  };

  const toggleMulti = (sectionId: string, optionId: string) => {
    const prev = (value[sectionId] as string[]) || [];
    const next = prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId];
    onChange({ ...value, [sectionId]: next });
  };

  const renderOption = (opt: FilterOption) => {
    const v = value[active!.id];
    const selected = Array.isArray(v) ? v.includes(opt.id) : v === opt.id;
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => (active!.type === "single" ? setSingle(active!.id, opt.id) : toggleMulti(active!.id, opt.id))}
        className="w-full flex items-center gap-3 py-2.5 px-2 rounded-md text-[15px] text-white/85 hover:bg-white/5 transition-all duration-150"
      >
        <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-150 ${selected ? "border-[#C89F4E]" : "border-white/30"}`}>
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#C89F4E]" />}
        </span>
        <span className="font-medium">{opt.label}</span>
      </button>
    );
  };

  return (
    <div className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-2 z-[70] w-[320px] max-w-[90vw]`}>
      <div
        ref={ref}
        className="rounded-[12px] overflow-hidden ring-1 ring-[#2A2A2A]/80 bg-[#121212]/95 backdrop-blur-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-col"
      >
        {/* Header */}
        <div className="relative h-14 flex items-center px-5 text-white font-semibold text-[17px] tracking-[0.25px] bg-gradient-to-r from-[#D9B15E] via-[#B78E3F] to-[#6E5730] border-b border-[#2A2A2A] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
          <div className="font-semibold text-[17px] tracking-[0.25px] text-white">Filter</div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center text-white bg-white/10 hover:bg-white/15 transition-all duration-150"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[1.3fr_2fr] border-t border-[#2A2A2A]">
          {/* Left column */}
          <div className="bg-[#2A2A2A]">
            {sections.map((s) => {
              const isActive = active!.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`w-full h-12 text-left px-5 text-[16px] font-semibold transition-colors duration-150 ease-in-out ${
                    isActive ? "bg-[#C89F4E] text-black rounded-r-lg" : "text-white/90 hover:bg-white/5"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Right column */}
          <div className="bg-[#0F0F0F] border-l border-[#2A2A2A] p-6">
            <div className="space-y-1">
              {active?.options?.length ? active.options.map(renderOption) : (
                <div className="text-white/50 text-[14px]">No options</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 bg-[#0B0B0B] border-t border-[#2A2A2A] flex items-center justify-between px-5">
          <button type="button" onClick={onClear} className="text-[#B8B8B8] text-[15px] font-medium hover:text-white transition">Clear All</button>
          <div className="w-px h-6 bg-[#2A2A2A]" />
          <button
            type="button"
            onClick={() => { onApply(); onClose(); }}
            className="text-[#C89F4E] text-[15px] font-semibold tracking-[1.2px] uppercase hover:opacity-90 transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
