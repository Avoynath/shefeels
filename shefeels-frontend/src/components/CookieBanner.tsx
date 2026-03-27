import React from "react";
import { useLocation } from "react-router-dom";
import Icon18 from "../assets/18+Icon.avif";
import ChatNowIcon from "../assets/home/ChatNowIcon.svg";

const STORAGE_KEY = "sf_cookies_accepted_v1";
const PREFS_KEY = "sf_cookies_prefs_v1";

const CookieBanner: React.FC = () => {
  const ageVerified = true;

  const [visible, setVisible] = React.useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return false;
    }
  });

  const [isMobile, setIsMobile] = React.useState(() => {
    try {
      return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
    } catch {
      return false;
    }
  });

  const acceptAll = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setVisible(false);
  };

  const [showSettings, setShowSettings] = React.useState(false);

  const openSettings = () => {
    setShowSettings(true);
  };

  const settingsRef = React.useRef<HTMLDivElement | null>(null);

  // load saved prefs (if any)
  const [prefs, setPrefs] = React.useState(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { necessary: true, functional: true, analytics: false };
  });

  React.useEffect(() => {

    // watch for viewport changes to toggle modal vs banner layout
    let mq: MediaQueryList | null = null;
    try {
      if (window.matchMedia) {
        mq = window.matchMedia("(max-width: 768px)");
        const mqHandler = (ev: MediaQueryListEvent) => setIsMobile(ev.matches);
        // older browsers use addListener
        if (mq.addEventListener) mq.addEventListener("change", mqHandler);
        else mq.addListener(mqHandler as any);
      }
    } catch {}
    const onDocClick = (e: MouseEvent) => {
      const el = settingsRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setShowSettings(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      if (mq) {
        try {
          if (mq.removeEventListener) mq.removeEventListener("change", (e: any) => setIsMobile(e.matches));
          else mq.removeListener((e: any) => setIsMobile(e.matches));
        } catch {}
      }
    };
  }, []);

  const savePrefs = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      // mark cookies as handled (banner closed)
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setShowSettings(false);
    setVisible(false);
  };

  const cancelPrefs = () => {
    setShowSettings(false);
  };

  const location = useLocation();
  const isFunnelRoute = ["/4902w", "/ads-funnel", "/payment-funnel"].includes(location.pathname);

  if (!ageVerified || !visible || isFunnelRoute) return null;

  // Mobile: render as centered modal (like AgeGate)
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/60 backdrop-blur-lg">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
          className="relative z-10 w-[92%] max-w-md rounded-2xl bg-black p-6 text-center shadow-2xl ring-1 ring-white/10"
        >
          <div className="flex flex-col items-center gap-4">
            <img src={Icon18} alt="18+" className="h-16 w-16 object-contain" />
            <h3 className="text-lg font-semibold text-[#E53170]">Cookies</h3>
            <p className="text-sm text-white/80 leading-relaxed max-w-sm">
              This site uses cookies to improve your experience. Please select your preferences or accept all cookies to continue.
            </p>

            <div className="mt-2 w-full flex flex-col gap-3 items-center">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full max-w-sm rounded-full px-6 py-3 text-base font-semibold focus:outline-none"
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "transparent",
                  color: "#FFFFFF",
                }}
              >
                🍪 Cookies Setting
              </button>

              <button
                onClick={acceptAll}
                className="w-full max-w-sm rounded-full px-6 py-3 text-base font-semibold focus:outline-none"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: "linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)",
                  color: "#FFFFFF",
                  padding: "0.75rem 1.5rem",
                  height: 48,
                  boxSizing: "border-box",
                  whiteSpace: "nowrap",
                }}
              >
                <img src={ChatNowIcon} alt="icon" style={{ width: 18, height: 18, display: "block" }} />
                <span style={{ display: "inline-block" }}>Accept all Cookies</span>
              </button>

              {/* settings modal inside mobile view */}
              {showSettings && (
                <div className="w-full max-w-sm mt-3 bg-[#0b0b0b] rounded-xl p-4 text-left">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Cookie preferences</div>
                  <div style={{ fontSize: 12, color: "#ddd", marginBottom: 12 }}>Select which cookies you allow.</div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <input type="checkbox" checked={true} disabled style={{ width: 16, height: 16 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Necessary</div>
                      <div style={{ fontSize: 12, color: "#bbb" }}>Required for core functionality</div>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!prefs.functional}
                      onChange={(e) => setPrefs((p: any) => ({ ...p, functional: e.target.checked }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>Functional</div>
                      <div style={{ fontSize: 12, color: "#bbb" }}>Enhances site experience</div>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!prefs.analytics}
                      onChange={(e) => setPrefs((p: any) => ({ ...p, analytics: e.target.checked }))}
                      style={{ width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>Analytics</div>
                      <div style={{ fontSize: 12, color: "#bbb" }}>Helps us improve the product</div>
                    </div>
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={() => setShowSettings(false)} className="px-3 py-2 rounded-md" style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
                      Cancel
                    </button>
                    <button onClick={savePrefs} className="px-3 py-2 rounded-md" style={{ background: "linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)", color: "#FFFFFF" }}>
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed left-0 right-0 bottom-0 z-9999 flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: "1920px",
          height: "125px",
          padding: "40px 70px",
          flexDirection: "row",
          alignItems: "center",
          gap: "20px",
          flexShrink: 0,
          // semi-transparent gradient so backdrop-filter shows through
          background: "linear-gradient(92deg, rgba(229, 49, 112, 0.45) -150.73%, rgba(11, 8, 19, 0.98) 53.73%)",
          // enable blur of content behind the banner
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        {/* left: icon + text */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src={Icon18} alt="18+" style={{ width: "64px", height: "64px", objectFit: "contain" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
            <div style={{ color: "#FFFFFF", fontSize: "16px", lineHeight: "1.5", fontWeight: 400 }}>
              This site is for adults only! It contains only AI-generated adult content. By entering this website, you confirm that you are 18 years old or more. By using the site, you agree to our use of cookies.
            </div>
          </div>
        </div>

  {/* right: actions */}
  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, position: "relative" }}>
          <button
            className="focus:outline-none hover:bg-white/5 transition-colors"
            style={{
              height: "44px",
              minHeight: "44px",
              boxSizing: "border-box",
              padding: "0 24px",
              borderRadius: "30px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: "transparent",
              color: "#FFFFFF",
              fontSize: "14px",
              lineHeight: "44px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
            }}
            onClick={openSettings}
          >
            🍪 Cookies Setting
          </button>

          {/* compact settings popover */}
          {showSettings && (
            <div
              ref={settingsRef}
              role="dialog"
              aria-label="Cookie settings"
              style={{
                position: "absolute",
                right: 0,
                bottom: "calc(100% + 12px)",
                width: 320,
                background: "#0b0b0b",
                color: "#fff",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                zIndex: 10000,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Cookie preferences</div>
              <div style={{ fontSize: 12, color: "#ddd", marginBottom: 12 }}>Select which cookies you allow.</div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <input type="checkbox" checked={true} disabled style={{ width: 16, height: 16 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Necessary</div>
                  <div style={{ fontSize: 12, color: "#bbb" }}>Required for core functionality</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={!!prefs.functional}
                  onChange={(e) => setPrefs((p: any) => ({ ...p, functional: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Functional</div>
                  <div style={{ fontSize: 12, color: "#bbb" }}>Enhances site experience</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={!!prefs.analytics}
                  onChange={(e) => setPrefs((p: any) => ({ ...p, analytics: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Analytics</div>
                  <div style={{ fontSize: 12, color: "#bbb" }}>Helps us improve the product</div>
                </div>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  onClick={cancelPrefs}
                  className="focus:outline-none"
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={savePrefs}
                  className="focus:outline-none"
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <button
            onClick={acceptAll}
            className="focus:outline-none hover:opacity-90 transition-opacity"
            style={{
              height: "44px",
              minHeight: "44px",
              boxSizing: "border-box",
              padding: "0 24px",
              borderRadius: "30px",
              border: "none",
              background: "linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)",
              color: "#FFFFFF",
              fontSize: "14px",
              lineHeight: "44px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
            }}
          >
            <img
              src={ChatNowIcon}
              alt="chat icon"
              style={{ width: 14, height: 14, display: "inline-block", verticalAlign: "middle", margin: 0, padding: 0 }}
            />
            <span style={{ display: "inline-block", verticalAlign: "middle" }}>Accept all Cookies</span>
          </button>
        </div>
      </div>
    </div>
  );

};

export default CookieBanner;
