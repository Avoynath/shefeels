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
        className="flex min-h-[86px] w-full items-center justify-between gap-6 px-6 py-5 text-left"
      >
        <span className="flex-1 text-[18px] font-normal leading-[30px] text-white md:text-[22px]">
          {q}
        </span>
        <span className={`grid h-10 w-10 shrink-0 place-items-center text-[42px] leading-none text-white transition-transform ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      <div
        ref={ref}
        style={{ maxHeight: height, opacity: open ? 1 : 0 }}
        className="overflow-hidden px-6 pb-5 text-[15px] leading-6 text-white/70 transition-all duration-300"
      >
        {a}
      </div>
    </div>
  );
};

const FAQSection: React.FC<{ gender?: string }> = () => {
  return (
    <section className="mx-auto w-full max-w-[1196px] px-4 py-12 sm:px-6 md:px-0 md:py-[60px]">
      <h2 className="mb-10 text-center text-[30px] font-bold leading-[1.2] text-white md:mb-[40px] md:text-[40px] md:leading-[50px]">
        Frequently Asked Questions
      </h2>

      <div className="space-y-[25px]">
        {FAQ_ROWS.map((row) => (
          <FAQRow key={row.q} {...row} />
        ))}
      </div>
    </section>
  );
};

export default FAQSection;
