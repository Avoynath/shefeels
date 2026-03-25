import { useEffect, useMemo, useRef, useState } from "react";

// Local type definitions to avoid circular imports
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
  const active = useMemo(
    () => sections?.find((s) => s.id === activeId) || sections?.[0],
    [sections, activeId]
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const setSingle = (sectionId: string, optionId: string) =>
    onChange({ ...value, [sectionId]: optionId });

  const toggleMulti = (sectionId: string, optionId: string) => {
    const prev = (value[sectionId] as string[]) || [];
    const next = prev.includes(optionId)
      ? prev.filter((id) => id !== optionId)
      : [...prev, optionId];
    onChange({ ...value, [sectionId]: next });
  };

  const renderOption = (opt: FilterOption) => {
    const v = value[active!.id];
    const selected = Array.isArray(v) ? v.includes(opt.id) : v === opt.id;
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() =>
          active!.type === "single"
            ? setSingle(active!.id, opt.id)
            : toggleMulti(active!.id, opt.id)
        }
        className={`w-full flex items-center gap-2 py-1 px-1 rounded-md text-[14px] transition-all duration-150 ${
          selected ? "text-[#C89F4E]" : "text-white/85 hover:bg-white/5"
        }`}
      >
        <span
          className={`inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border-[1.5px] transition-all duration-150 ${
            selected ? "border-[#C89F4E]" : "border-white/30"
          }`}
        >
          {selected && <span className="w-[6px] h-[6px] rounded-full bg-[#C89F4E]" />}
        </span>
        <span className="font-medium">{opt.label}</span>
      </button>
    );
  };

  return (
    <div
      className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-2 z-[70]`}
      style={{ width: "fit-content" }}
    >
      <div
        ref={ref}
        className="w-[460px] max-w-[92vw] rounded-[14px] overflow-hidden ring-1 ring-[#2A2A2A]
                   bg-[#121212]/95 backdrop-blur-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.55)] flex flex-col"
      >
        {/* Header */}
        <div className="relative h-12 flex items-center px-5 text-white font-semibold text-[17px]
                        bg-gradient-to-r from-[#D0A957] via-[#A88138] to-[#6A5636] border-b border-[#2A2A2A]">
          <div>Filter</div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center text-white
                       bg-white/10 hover:bg-white/15 transition-all duration-150"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[160px_minmax(0,1fr)] border-t border-[#2A2A2A]">
          {/* Left column */}
          <div className="bg-[#2E2E2E]">
            {sections.map((s) => {
              const isActive = active!.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`w-full h-10 text-left px-3 text-[14px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? "bg-[#D4A646] text-black rounded-r-lg"
                      : "text-white/90 hover:bg-white/5"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Right column */}
          <div className="bg-[#1C1C1C] border-l border-[#2A2A2A] p-3">
            <div className="space-y-[2px]">
              {active?.options?.length ? active.options.map(renderOption) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 bg-[#121212] border-t border-[#2A2A2A] flex items-center justify-between px-6">
          <button
            type="button"
            onClick={onClear}
            className="text-[#B8B8B8] text-[14px] font-semibold hover:text-white transition-colors"
          >
            Clear All
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="text-[#C89F4E] text-[14px] font-semibold tracking-[0.05em] uppercase hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
