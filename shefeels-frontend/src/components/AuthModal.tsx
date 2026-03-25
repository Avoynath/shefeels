import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const Login = lazy(() => import("../pages/Login"));

function focusableElements(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[];
  const els = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
  return els.filter((el) => !el.hasAttribute("disabled"));
}

export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // start enter animation on next tick
      requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      // start exit animation
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setVisible(false);
        setTimeout(() => onClose(), 220);
      }
      if (e.key === "Tab" && contentRef.current) {
        const els = focusableElements(contentRef.current);
        if (!els.length) return;
        const idx = els.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey) {
          if (idx === 0) {
            e.preventDefault();
            els[els.length - 1].focus();
          }
        } else {
          if (idx === els.length - 1) {
            e.preventDefault();
            els[0].focus();
          }
        }
      }
    }

    if (mounted) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  useEffect(() => {
    if (visible && contentRef.current) {
      const els = focusableElements(contentRef.current);
      if (els.length) els[0].focus();
    }
  }, [visible]);

  // Check if the click is on the modal card or its contents
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Find if the click is inside the modal card (has data-modal-card) or any of its children
    const modalCard = contentRef.current?.querySelector('[data-modal-card]');
    if (modalCard && modalCard.contains(target)) {
      // Click is inside the card, don't close
      return;
    }
    // Click is outside the card, close the modal
    setVisible(false);
    setTimeout(() => onClose(), 220);
  }, [onClose]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      {/* Overlay - visual only */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 pointer-events-none ${visible ? "opacity-100" : "opacity-0"
          }`}
      />

      {/* Content */}
      <div
        ref={contentRef}
        className={`relative z-10 w-[min(720px,92%)] transform transition-all duration-200 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        role="dialog"
        aria-modal="true"
      >
        <Suspense fallback={<div className="bg-white rounded-lg p-8 min-h-[400px] flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>}>
          <Login onClose={() => { setVisible(false); setTimeout(() => onClose(), 220); }} />
        </Suspense>
      </div>
    </div>
  );
}
