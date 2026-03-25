import React, { useEffect, useRef, useState } from "react";
import Button from "./Button";

const STORAGE_KEY = "honeylove_age_verified_v1";

// OPTIMIZATION: Inline SVG instead of loading external image - eliminates network request
const Icon18SVG = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" stroke="#FFD700" strokeWidth="3" fill="none" />
    <text x="32" y="38" textAnchor="middle" fill="#FFD700" fontSize="22" fontWeight="bold" fontFamily="sans-serif">18+</text>
  </svg>
);

const AgeGate: React.FC = () => {
  // OPTIMIZATION: Check localStorage synchronously to avoid flash
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleExit();
      if (e.key === "Enter") handleContinue();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleContinue = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch { }
    // notify other components in the same window that age verification passed
    try {
      window.dispatchEvent(new CustomEvent("honeylove:age-verified"));
    } catch { }
    setOpen(false);
  };

  const handleExit = () => {
    window.location.href = "https://www.google.com";
  };

  if (!open) return null;

  return (
    // OPTIMIZATION: Reduced backdrop-blur from 'lg' to 'sm' for faster GPU compositing
    // Added will-change hint for smoother animation
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ willChange: 'opacity' }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Age verification"
        className="relative z-10 w-[92%] max-w-md rounded-2xl bg-black p-8 text-center shadow-2xl ring-1 ring-white/10"
      >
        <div className="flex flex-col items-center gap-6">
          {/* OPTIMIZATION: Inline SVG - no network request needed */}
          <Icon18SVG />

          <h3 className="text-lg font-semibold text-yellow-400">
            Warning 18 +
          </h3>

          <p className="text-sm text-white/80 leading-relaxed max-w-sm">
            Our AI Companion experience is intended for adults only. Please
            confirm you are 18 years or older before continuing.
          </p>

          {/* Buttons */}
          <div className="mt-2 w-full flex flex-col gap-3 items-center">
            <Button
              onClick={handleContinue}
              variant="agePrimary"
              className="w-full max-w-sm py-3.5 text-[22px] leading-[1.2]"
            >
              I am over 18- Continue
            </Button>

            <Button
              onClick={handleExit}
              variant="ageSecondary"
              className="w-full max-w-sm py-3.5 text-[22px] leading-[1.2]"
            >
              I am NOT over 18- Exit
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeGate;

