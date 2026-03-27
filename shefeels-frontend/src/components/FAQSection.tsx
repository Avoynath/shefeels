import React, { useEffect, useRef, useState } from "react";

type Row = {
  q: string;
  a: string;
};

const FAQ_ROWS: Row[] = [
  {
    q: "How close is this redesign to the Figma?",
    a: "The structure, spacing, palette, and major surface treatments are being aligned section by section so the live page tracks the design much more closely than the original layout.",
  },
  {
    q: "Will the real content and routing still work?",
    a: "Yes. The UI is being reskinned around the current React app and route behavior, so the design moves closer to the Figma without throwing away existing app wiring.",
  },
  {
    q: "Can every section be matched exactly?",
    a: "Where the design relies on static handoff art or text, it can be matched very tightly. Where the live app depends on API data, the styling can match while preserving the real content model.",
  },
  {
    q: "What happens if a detail cannot be reproduced cleanly?",
    a: "It will be called out directly instead of being invented. The goal is a faithful implementation without hallucinated assets or fake behaviors.",
  },
  {
    q: "Why are the sections being done in slices?",
    a: "That keeps each checkpoint reviewable, reduces regressions, and makes it easier to adjust the page in the exact order you want.",
  },
];

const FAQRow: React.FC<Row> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState("0px");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(open ? `${el.scrollHeight}px` : "0px");
  }, [open]);

  return (
    <div className="rounded-[16px] bg-[rgba(255,255,255,0.08)] shadow-[0_3px_20px_rgba(20,27,52,0.04)] transition-colors duration-300">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-6 px-4 py-3 text-left"
      >
        <span className="flex-1 text-base font-medium leading-snug text-white">
          {q}
        </span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center text-2xl leading-none text-white transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      <div
        ref={ref}
        style={{ maxHeight: height, opacity: open ? 1 : 0 }}
        className="overflow-hidden px-4 pb-3 text-sm leading-relaxed text-white/70 transition-all duration-300"
      >
        {a}
      </div>
    </div>
  );
};

const FAQSection: React.FC<{ gender?: string }> = () => {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-2">
      <h2 className="mb-10 text-center text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-white">
        Frequently Asked Questions
      </h2>

      <div className="space-y-4">
        {FAQ_ROWS.map((row) => (
          <FAQRow key={row.q} {...row} />
        ))}
      </div>
    </section>
  );
};

export default FAQSection;
