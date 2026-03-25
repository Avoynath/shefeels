import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useThemeStyles } from "../utils/theme";
import Button from "../components/Button";
import ChangePasswordIcon from "../assets/auth/ChangePasswordIcon.svg";
import DeleteIcon from "../assets/DeleteIcon.svg";
import SubscriptionIcon from "../assets/SubscriptionIcon.svg";
import PremiumIcon from "../assets/PremiumIcon.svg";
import tokenIcon from "../assets/token.svg";
import Modal from "../components/Modal";
import { buildApiUrl } from '../utils/apiBase';
import fetchWithAuth from '../utils/fetchWithAuth';
import { useToastActions } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/api';
import { IconSpinner } from '../utils/chatUtils';

// ------------------------------------------------------------
// Small SVG icons
// ------------------------------------------------------------
const Eye = ({ open }: { open?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-80">
    {open ? (
      <path stroke="currentColor" strokeWidth="1.6" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    ) : (
      <>
        <path stroke="currentColor" strokeWidth="1.6" d="M3 3l18 18" />
        <path stroke="currentColor" strokeWidth="1.6" d="M4.5 6.2C6.7 4.4 9.2 3 12 3c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.1 4.3M6.5 8.4C5 9.8 4 12 4 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" />
      </>
    )}
  </svg>
);
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-80">
    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-80">
    <path d="M9 7l1.5-2h3L15 7h3.5A2.5 2.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5A2.5 2.5 0 0 1 5.5 7H9Z" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="opacity-90">
  <rect x="5" y="7" width="14" height="14" rx="2.2" stroke="var(--accent-danger)" strokeWidth="1.6" />
  <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="var(--accent-danger)" strokeWidth="1.6" />
    <path d="M4 7h16" stroke="#ff6b6b" strokeWidth="1.6" />
  </svg>
);

// NOTE: The design now uses an SVG asset at src/assets/DeleteIcon.svg.
// We import and render that image inside a wrapper with the requested
// styling (border-radius:6px and background rgba(255,56,45,0.15)).

// ------------------------------------------------------------
// Small shared inputs
// ------------------------------------------------------------
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-white/80 mb-2">{children}</div>;
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
  right,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  right?: React.ReactNode;
  type?: string;
}) {
  return (
    <div className="relative">
      <input
        disabled={disabled}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-black/40 px-4 py-3 pr-10 placeholder-white/40 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-(--hl-gold)"
        style={{ color: 'var(--primary, #FFC54D)' }}
      />
      {right && <div className="absolute inset-y-0 right-3 flex items-center text-white/70">{right}</div>}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={show ? "text" : "password"}
      right={
        <button type="button" aria-label={show ? "Hide" : "Show"} onClick={() => setShow((s) => !s)} className="p-1">
          <Eye open={show} />
        </button>
      }
    >
      {/* children unused intentionally */}
    </Input>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl bg-black/40 px-4 py-3 text-left text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-(--hl-gold)"
      >
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--primary, #FFC54D)' }}>{value}</span>
          <span className="text-white/60">▾</span>
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl ring-1 ring-white/10" style={{ background: 'var(--bg-0b0b0b)' }}>
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 ${
                opt === value ? "bg-yellow-900/40" : ""
              } ${i !== 0 ? "border-t border-white/5" : ""}`}
              style={{ color: opt === value ? 'var(--primary, #FFC54D)' : 'rgba(255, 255, 255, 0.8)' }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Basic date picker (no deps)
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function formatDate(d?: Date | null) {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function DatePicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(value ?? new Date(2000, 0, 1));

  // year selector state
  const [yearOpen, setYearOpen] = useState(false);

  const days = useMemo(() => {
    const s = startOfMonth(cursor);
    const e = endOfMonth(cursor);
    const firstIdx = (s.getDay() + 6) % 7; // Monday-first
    const total = firstIdx + e.getDate();
    return Array.from({ length: Math.ceil(total / 7) * 7 }).map((_, i) => {
      const dayNum = i - firstIdx + 1;
      const inMonth = dayNum >= 1 && dayNum <= e.getDate();
      const date = inMonth ? new Date(cursor.getFullYear(), cursor.getMonth(), dayNum) : null;
      return { label: inMonth ? String(dayNum) : "", date } as { label: string; date: Date | null };
    });
  }, [cursor]);

  return (
    <div className="relative">
      <Input
        value={formatDate(value)}
        onChange={() => {}}
        placeholder="DD-MM-YYYY"
        right={
          <button type="button" onClick={() => setOpen((o) => !o)} className="p-1">
            <CalendarIcon />
          </button>
        }
      />
      {open && (
        <div className="absolute z-20 mt-2 w-75 rounded-xl ring-1 ring-white/10 bg-[#0f0f0f] p-4">
          <div className="flex items-center justify-between text-white mb-3">
            <button className="px-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>◀</button>
            <div className="font-semibold flex items-center gap-2">
              <button type="button" onClick={() => setYearOpen((y) => !y)} className="px-2 py-1 rounded hover:bg-white/5">{cursor.getFullYear()}</button>
              <div className="px-2">{cursor.toLocaleString(undefined, { month: "long" })}</div>
            </div>
            <button className="px-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>▶</button>
          </div>
          {yearOpen && (
            <div className="mb-2 max-h-40 overflow-auto">
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 120 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setCursor(new Date(y, cursor.getMonth(), 1));
                        setYearOpen(false);
                      }}
                      className={`py-1 text-left px-2 rounded ${y === cursor.getFullYear() ? "bg-(--hl-gold) text-black" : "hover:bg-white/5 text-white/80"}`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/60 mb-1">
            {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => (
              <button
                key={i}
                disabled={!d.date}
                onClick={() => {
                  if (d.date) {
                    onChange(d.date);
                    setOpen(false);
                  }
                }}
                className={`h-8 rounded-md text-sm ${
                  d.date ? "hover:bg-white/10 text-white" : "text-transparent cursor-default"
                } ${formatDate(d.date) === formatDate(value) ? "bg-(--hl-gold)-black" : ""}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



// ------------------------------------------------------------
// Page component
// ------------------------------------------------------------
export default function Profile() {
  const { colors, components } = useThemeStyles();
  const cardBase = components.cardBase;
  // make the main title larger to match figma
  const heading = "text-4xl font-normal " + colors.text;
  // smaller gap and styling for the sub header (uppercase) - color applied inline so we can use var(--primary)
  const sub = "mt-1 text-base font-semibold uppercase tracking-wide";
  // prefer Button primitive instead of raw token strings
  const badge = "inline-flex items-center gap-1 rounded-lg bg-[var(--hl-gold)] text-black px-2 py-0.5 text-xs font-medium";
  
  // Personal info
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<string>(() => {
    try {
      return localStorage.getItem("hl_gender") || "Male";
    } catch {
      return "Male";
    }
  });
  const [birth, setBirth] = useState<Date | null>(null);
  const [avatarHue, setAvatarHue] = useState(30);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [passSuccessOpen, setPassSuccessOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState<boolean>(false);
  const [tokensAvailable, setTokensAvailable] = useState<number | null>(null);
  const [passLoading, setPassLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [birthError, setBirthError] = useState<string | null>(null);

  // Password
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // Dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showError, showSuccess } = useToastActions();

  // password validation: 8-15 chars, letters/numbers/common specials, no spaces
  const PASS_REGEX = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]{8,15}$/;
  const canChange = useMemo(() => {
    const oldOk = oldPass.length >= 8; // backend requires min 8
    const newOk = PASS_REGEX.test(newPass);
    const confirmOk = PASS_REGEX.test(confirmPass) && newPass === confirmPass;
    return oldOk && newOk && confirmOk;
  }, [oldPass, newPass, confirmPass]);

  const handleUpdateProfile = () => {
    // placeholder kept for backward compatibility
    try {
      localStorage.setItem("hl_gender", gender);
    } catch {}
    try { showSuccess('Profile updated'); } catch {}
  };

  // Reference otherwise-unused state setters/values to avoid TS unused errors in builds
  useEffect(() => {
    void setAvatarHue;
    void profileId;
    void setProfileId;
    void handleUpdateProfile;
    void badge;
    void CameraIcon;
    // referenced to avoid unused variable/type errors when buttons don't read them
    void loading;
    void passLoading;
    void canChange;
  }, []);

  // helper: parse ISO date string to Date
  function parseIso(d?: string | null) {
    if (!d) return null;
    const t = Date.parse(d);
    if (Number.isNaN(t)) return null;
    return new Date(t);
  }

  // validate birth (min 18)
  useEffect(() => {
    if (!birth) {
      setBirthError(null);
      return;
    }
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear() - (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate()) ? 1 : 0);
    if (age < 18) {
      setBirthError("You must be at least 18 years old.");
    } else {
      setBirthError(null);
    }
  }, [birth]);

  // fetch profile on mount
  const { token, user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // redirect to login if not authenticated
  useEffect(() => {
    if (!token) {
      navigate("/login", { state: { from: location } });
    }
  }, [token, navigate, location]);

  useEffect(() => {
    // fetch profile (defined below) on mount and always fetch subscription details
    fetchProfile();
    fetchSubscriptionDetails();
    // polling: refresh profile + subscription details periodically
    const pollInterval = 15000; // 15s
    const id = setInterval(() => {
      fetchProfile();
      fetchSubscriptionDetails();
    }, pollInterval);
    return () => clearInterval(id);
  }, [token]);

  // submit updated profile
  async function submitProfileUpdate() {
    if (birthError) {
      try { showError(birthError); } catch {}
      return;
    }
    const url = buildApiUrl('/user/add-update-profile');
    const fd = new FormData();
    if (fullName) fd.append("full_name", fullName);
    if (email) fd.append("email", email);
    if (username) fd.append("username", username);
    if (gender) fd.append("gender", gender);
    if (birth) fd.append("birth_date", birth.toISOString());
    if (selectedFile) fd.append("file", selectedFile);

    try {
      setLoading(true);
      const res = await fetchWithAuth(url, { method: "POST", body: fd, credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const body = json ?? null;
        const message = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : (res.statusText || `HTTP ${res.status}`);
        const e: any = new Error(message);
        e.status = res.status;
        e.body = body;
        throw e;
      }

      // success — refresh profile from backend and show success modal
      await fetchProfile();
      setSuccessOpen(true);
      setTimeout(() => setSuccessOpen(false), 2000);

      setSelectedFile(null);
      if (selectedPreview) {
        try { URL.revokeObjectURL(selectedPreview); } catch {}
        setSelectedPreview(null);
      }
    } catch (err: any) {
      console.error(err);
      try {
        const status = (err && typeof err.status === 'number') ? err.status : (err?.status || 0);
        if (status >= 400 && status < 500) {
          const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
          showError('Failed to update profile', detail);
        } else if (status >= 500) {
          try { console.warn('Profile: server error', status, err?.body ?? err); } catch {}
          showError('Failed to update profile', 'Unable to update your profile right now.');
        } else {
          showError('Failed to update profile', getErrorMessage(err));
        }
      } catch (e) {
        try { showError('Failed to update profile', getErrorMessage(err)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  // reusable fetch profile helper
  async function fetchProfile() {
    const url = buildApiUrl('/user/get-profile');
    try {
      setLoading(true);
      const res = await fetchWithAuth(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch profile");
      setEmail(data.email ?? "");
      setUsername(data.username ?? "");
      setFullName(data.full_name ?? "");
      setGender(data.gender ?? gender);
      setBirth(parseIso(data.birth_date));
      setProfileImageUrl(data.profile_image_url ?? null);
      setProfileId(data.profile_id ?? null);
      try {
        if (typeof setUser === 'function') {
          try {
            (setUser as any)((prev: any) => ({
              ...(prev || {}),
              name: data.full_name || data.name || prev?.name,
              email: data.email ?? prev?.email,
              avatar: data.profile_image_url || data.profile_image || prev?.avatar || null,
              role: data.user_role || data.role || prev?.role,
              hasActiveSubscription: data.hasActiveSubscription ?? prev?.hasActiveSubscription ?? false,
              tokenBalance: Number((data.tokenBalance ?? data.coins ?? data.tokens ?? prev?.tokenBalance) || 0),
              subscription_coin_reward: Number(data.subscription_coin_reward ?? prev?.subscription_coin_reward ?? 0),
              subscription_plan_name: data.subscription_plan_name ?? prev?.subscription_plan_name,
            }));
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {}
      // tokens/coins: try common response fields from backend
      const tokens = data.total_coins ?? data.coins ?? data.tokens ?? data.wallet?.coins ?? data.wallet?.balance ?? data.available_coins ?? null;
      setTokensAvailable(typeof tokens === 'number' ? tokens : (tokens ? Number(tokens) : null));
      // Always fetch subscription details for authenticated users so we can
      // show explicit expired/renew messaging in Profile even when
      // `hasActiveSubscription` is false.
      await fetchSubscriptionDetails();
    } catch (err) {
      console.error("fetchProfile", err);
    } finally {
      setLoading(false);
    }
  }
  
  // fetch subscription details
  async function fetchSubscriptionDetails() {
    const url = buildApiUrl('/api/v1/tagada/subscription/me');
    setSubscriptionLoading(true);
    try {
      const res = await fetchWithAuth(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) return;
      const data = await res.json();
      setSubscriptionDetails(data);
    } catch (err) {
      console.error("fetchSubscriptionDetails", err);
    } finally {
      setSubscriptionLoading(false);
    }
  }
  // Refresh subscription details when auth-level subscription flag changes
  useEffect(() => {
    try {
      // When AuthContext updates user's hasActiveSubscription (e.g. via WS),
      // refresh subscription details so the profile page shows correct state.
      fetchSubscriptionDetails();
    } catch {}
  }, [ (user as any)?.hasActiveSubscription, token ]);
  const handleChangePassword = async () => {
    // client-side validation messages
    if (oldPass.length < 8) {
      try { showError("Old password must be at least 8 characters."); } catch {}
      return;
    }
    if (!PASS_REGEX.test(newPass)) {
      try { showError("New password must be 8-15 chars (letters, numbers, or special characters)."); } catch {}
      return;
    }
    if (newPass !== confirmPass) {
      try { showError("New password and confirmation must match."); } catch {}
      return;
    }
    const url = buildApiUrl('/auth/change-password');
    try {
      setPassLoading(true);
      const res = await fetchWithAuth(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ old_password: oldPass, new_password: newPass }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const body = data ?? null;
        const message = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : (res.statusText || `HTTP ${res.status}`);
        const e: any = new Error(message);
        e.status = res.status;
        e.body = body;
        throw e;
      }

  // show the same modal feedback as Update Profile
  setPassSuccessOpen(true);
  setOldPass("");
  setNewPass("");
  setConfirmPass("");
  setTimeout(() => setPassSuccessOpen(false), 2000);
    } catch (err: any) {
      console.error("changePassword", err);
      try {
        const status = (err && typeof err.status === 'number') ? err.status : (err?.status || 0);
        if (status >= 400 && status < 500) {
          const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
          showError('Unable to change password', detail);
        } else if (status >= 500) {
          try { console.warn('Profile changePassword: server error', status, err?.body ?? err); } catch {}
          showError('Unable to change password', 'Unable to change password right now.');
        } else {
          showError('Unable to change password', getErrorMessage(err));
        }
      } catch (e) {
        try { showError('Unable to change password', getErrorMessage(err)); } catch {}
      }
    } finally {
      setPassLoading(false);
    }
  };

  return (
  <div className="max-w-6xl mx-auto px-3 py-6">
      <div>
        <h1 className={heading}>Profile</h1>
          <p className={sub} style={{ color: "var(--primary)" }}>PERSONAL INFORMATION</p>
      </div>

      {/* PERSONAL INFORMATION */}
      <div className="mt-6 grid gap-6">
        <section className={`${cardBase} bg-[#0f0f0f]`}>
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-6">
            <div className="relative shrink-0 self-center md:self-auto">
              {/* larger avatar and click-to-upload (removed separate upload/remove buttons per design) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                className="h-40 w-40 rounded-full ring-1 ring-white/10 overflow-hidden bg-black/40 cursor-pointer"
                title="Click to upload avatar"
              >
                {selectedPreview ? (
                  // preview from selected file
                  <img src={selectedPreview} alt="avatar preview" className="h-full w-full object-cover" />
                ) : profileImageUrl ? (
                  <img src={profileImageUrl} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <div style={{ background: `linear-gradient(135deg, hsla(${avatarHue},80%,60%,0.35), transparent)` }} className="h-full w-full" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpg,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  const allowed = ["image/png", "image/jpg", "image/jpeg"];
                  if (!allowed.includes(f.type)) {
                    try { showError("Invalid file type. Use PNG/JPG/JPEG."); } catch {}
                    return;
                  }
                  setSelectedFile(f);
                  const url = URL.createObjectURL(f);
                  setSelectedPreview(url);
                }}
              />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {/* removed separate upload/remove avatar action buttons — upload is handled by clicking the avatar */}
            </div>
            </div>

            <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-5 w-full">
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={setFullName} placeholder="Your full name" />
              </div>

              <div>
                <Label>Email Id</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1"><Input value={email} onChange={setEmail} disabled /></div>
                </div>
              </div>

              <div>
                <Label>Username</Label>
                <Input value={username} onChange={setUsername} />
              </div>

              <div>
                <Label>Gender</Label>
                <Select value={gender} onChange={setGender} options={["Male", "Female", "Trans"]} />
              </div>

              <div>
                <Label>Birth Date</Label>
                <DatePicker value={birth} onChange={setBirth} />
                {birthError && <div className="text-sm text-rose-400 mt-1">{birthError}</div>}
              </div>

              {/* Update button aligned with the Birth Date input (not the label) */}
              <div className="sm:col-span-1 md:col-span-2 lg:col-span-1 mt-8 flex justify-center sm:justify-start">
                <Button
                    onClick={submitProfileUpdate}
                    variant="primary"
                    className="w-full flex items-center justify-center gap-3"
                    style={{
                      borderRadius: 60,
                      border: "1px solid rgba(255,255,255,0.50)",
                      background: "linear-gradient(90deg, #FFC54D 0%, #FFD784 100%)",
                      boxShadow: "0 8px 20px rgba(255,197,77,0.18)",
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 animate-spin" />Updating…</span>
                    ) : (
                      <>
                        <img src={ChangePasswordIcon} alt="icon" className="h-5 w-5" aria-hidden />
                        <span className="text-sm font-semibold">Update profile</span>
                      </>
                    )}
                  </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section headers for PASSWORD and DELETE ACCOUNT to match Figma */}
        <div className="grid lg:grid-cols-2 gap-6">
          <p className={sub} style={{ color: "var(--primary)" }}>PASSWORD</p>
          <p className={sub + " lg:block hidden"} style={{ color: "var(--primary)" }}>DELETE ACCOUNT</p>
        </div>

        {/* PASSWORD + DELETE */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Password card */}
          <section className={cardBase}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-yellow-900/40 grid place-items-center ring-1 ring-white/10">
                <span role="img" aria-label="lock">🔒</span>
              </div>
              <div className="text-white font-semibold">Set a new password</div>
            </div>

            <div className="grid gap-4">
              <div>
                <Label>Old Password</Label>
                <PasswordInput value={oldPass} onChange={setOldPass} placeholder="Enter" />
              </div>
              <div>
                <Label>New Password</Label>
                <PasswordInput value={newPass} onChange={setNewPass} placeholder="Enter" />
              </div>
              <div>
                <Label>Confirm new Password</Label>
                <PasswordInput value={confirmPass} onChange={setConfirmPass} placeholder="Enter" />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 justify-center sm:justify-start">
                <Button
                  variant="primary"
                  className="w-56 flex items-center justify-center gap-3"
                  onClick={handleChangePassword}
                  style={{
                    borderRadius: 60,
                    border: "1px solid rgba(255,255,255,0.50)",
                    background: "linear-gradient(90deg, #FFC54D 0%, #FFD784 100%)",
                    boxShadow: "0 8px 20px rgba(255,197,77,0.18)",
                  }}
                  disabled={passLoading}
                >
                  {passLoading ? (
                    <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 animate-spin" />Changing…</span>
                  ) : (
                    <>
                      <img src={ChangePasswordIcon} alt="icon" className="h-5 w-5" aria-hidden />
                      <span className="text-sm font-semibold">Change Password</span>
                    </>
                  )}
                </Button>
            </div>
          </section>

          {/* Delete account card */}
          <section className={cardBase}>
            <div className="lg:hidden mb-4">
              <p className={sub} style={{ color: "var(--primary)" }}>DELETE ACCOUNT</p>
            </div>
            <div className="flex flex-col items-center text-center gap-5">
              <div className="rounded-md bg-[rgba(255,56,45,0.15)] p-3">
                <img src={DeleteIcon} alt="delete icon" className="h-12 w-12" />
              </div>
              <p className="text-sm text-white/80 max-w-md">
                You have an option to delete your account, but beware,
                {" "}
                <span className="text-(--hl-gold)">you will not be able to access it</span>
                {" "}
                if you proceed.
              </p>
              <Button variant="primary" className="w-56" onClick={() => setConfirmOpen(true)}>Delete Account</Button>
            </div>
          </section>
        </div>

        {/* Subscription - show for logged-in users (including while loading) */}
        {user && ((subscriptionDetails) || ((user as any).hasActiveSubscription) || ((user as any).isSubscribed) || (user as any).role === 'admin' || subscriptionLoading) && (
          <>
            <div>
              <p className={sub} style={{ color: "var(--primary)" }}>SUBSCRIPTION</p>
            </div>
            <section className={cardBase}>
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <img src={SubscriptionIcon} alt="Subscription" className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">SUBSCRIPTION</h3>
                  {(subscriptionDetails || (user as any).hasActiveSubscription) ? (
                    <>
                      {subscriptionDetails?.status === 'expired' ? (
                        <div className="mb-4">
                          <p className="text-sm text-orange-400 mb-3">Your subscription has expired. Renew to continue enjoying premium benefits.</p>
                          <button
                            onClick={() => window.location.href = '/premium'}
                            className="w-full bg-linear-to-r from-(--hl-gold) to-yellow-500 text-black font-bold py-2.5 px-4 rounded-lg hover:shadow-lg hover:shadow-yellow-500/50 transition-all"
                          >
                            Renew Subscription
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-white/60 mb-3">You are subscribed to our premium plan. Use tokens to access premium features or buy more tokens below.</p>
                      )}
                      
                      {/* Subscription Details */}
                      <div className="mb-4 space-y-3 rounded-lg bg-white/5 p-4 border border-white/10">
                        {subscriptionDetails ? (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">Plan:</span>
                              <span className="text-white font-semibold">{subscriptionDetails.plan_name || 'Premium'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/60">Status:</span>
                              <span className={`font-semibold capitalize ${
                                subscriptionDetails.status === 'active' ? 'text-emerald-400' :
                                subscriptionDetails.status === 'expired' ? 'text-orange-400' :
                                subscriptionDetails.status === 'cancelled' ? 'text-red-400' :
                                'text-white'
                              }`}>
                                {subscriptionDetails.status || 'Active'}
                              </span>
                            </div>
                            {subscriptionDetails.billing_cycle && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Billing Cycle:</span>
                                <span className="text-white font-semibold">{subscriptionDetails.billing_cycle}</span>
                              </div>
                            )}
                            {subscriptionDetails.current_period_end ? (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Next Billing Date:</span>
                                <span className="text-white">{new Date(subscriptionDetails.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Next Billing Date:</span>
                                <span className="text-white/40 italic">Not set</span>
                              </div>
                            )}
                            {tokensAvailable !== null && (
                              <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                                <span className="text-white/60">Available Tokens:</span>
                                <span className="text-(--hl-gold) font-bold text-base">{tokensAvailable.toLocaleString()}</span>
                              </div>
                            )}
                            {subscriptionDetails.total_coins_rewarded > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Total Earned:</span>
                                <span className="text-(--hl-gold) font-semibold">{subscriptionDetails.total_coins_rewarded.toLocaleString()}</span>
                              </div>
                            )}
                            {subscriptionDetails.cancel_at_period_end && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <p className="text-sm text-orange-400">⚠️ Your subscription will be cancelled at the end of the current period.</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-white/40 text-sm">Loading subscription details...</p>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => navigate('/buy-tokens')}
                        className="flex items-center gap-2 px-6 py-3 text-black font-semibold"
                        style={{
                          borderRadius: '60px',
                          border: '1px solid rgba(255, 255, 255, 0.50)',
                          background: 'linear-gradient(90deg, #FFC54D 0%, #FFD784 100%)'
                        }}
                      >
                        <img src={tokenIcon} alt="Tokens" className="w-5 h-5" />
                        Buy Tokens
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-white/60 mb-4">You are not subscribed to our premium plan. Subscribe to our premium plan to get access to all the features.</p>
                      <button
                        onClick={() => navigate('/premium')}
                        className="flex items-center gap-2 px-6 py-3 text-black font-semibold"
                        style={{
                          borderRadius: '60px',
                          border: '1px solid rgba(255, 255, 255, 0.50)',
                          background: 'linear-gradient(90deg, #FFC54D 0%, #FFD784 100%)'
                        }}
                      >
                        <img src={PremiumIcon} alt="Premium" className="w-5 h-5" />
                        Upgrade to Premium
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Delete dialog */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-2xl grid place-items-center" style={{ background: "linear-gradient(135deg,#431417,#1a0b0c)" }}>
            <TrashIcon />
          </div>
          <div className="text-2xl font-bold text-(--hl-gold)">Delete Account</div>
          <p className="text-white/80 max-w-md">After deleting your account you have 30 days to reactivate or it will be definitive.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-full px-6 py-3 text-white/90 bg-white/10 ring-1 ring-white/10 hover:bg-white/15" onClick={() => setConfirmOpen(false)} disabled={deleteLoading}>
              Cancel
            </button>
            <button
              className="rounded-full px-6 py-3 text-black bg-linear-to-b from-(--hl-gold) to-(--hl-gold-strong) hover:from-(--hl-gold) hover:to-(--hl-gold-strong)"
              onClick={async () => {
                try {
                  setDeleteLoading(true);
                  const url = buildApiUrl('/user/delete-account');
                  const res = await fetchWithAuth(url, { method: 'POST', credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                  if (res && res.ok) {
                    setConfirmOpen(false);
                    try { showSuccess('Account scheduled for deletion'); } catch {}
                  } else {
                    // Try to parse error message
                    let body = null;
                    try { body = await res?.json().catch(() => null); } catch {}
                    const msg = body?.message || body?.detail || res?.statusText || `HTTP ${res?.status}`;
                    try { showError('Unable to delete account', msg as string); } catch {}
                  }
                } catch (err) {
                  console.error('deleteAccount', err);
                  try { showError('Unable to delete account', 'Request failed'); } catch {}
                } finally {
                  setDeleteLoading(false);
                }
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? <span className="inline-flex items-center gap-2"><IconSpinner className="w-4 h-4 animate-spin" />Deleting…</span> : 'Yes Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Success toast/modal */}
      <Modal open={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full grid place-items-center bg-(--hl-gold) text-black text-2xl">✓</div>
          <div className="text-xl font-semibold">Profile updated</div>
          <div className="text-sm text-white/80">Your profile was updated successfully.</div>
          <div className="mt-2">
            <button className="rounded-full px-6 py-2 bg-white/10 hover:bg-white/15" onClick={() => setSuccessOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>

      {/* Password change success modal (same style as profile update) */}
      <Modal open={passSuccessOpen} onClose={() => setPassSuccessOpen(false)}>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full grid place-items-center bg-(--hl-gold) text-black text-2xl">✓</div>
          <div className="text-xl font-semibold">Password changed</div>
          <div className="text-sm text-white/80">Your password was changed successfully.</div>
          <div className="mt-2">
            <button className="rounded-full px-6 py-2 bg-white/10 hover:bg-white/15" onClick={() => setPassSuccessOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>

      {/* Toasts are handled globally via ToastContext */}
    </div>
  );
}
