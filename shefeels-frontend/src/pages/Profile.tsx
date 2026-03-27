import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Modal from "../components/Modal";
import ChangePasswordIcon from "../assets/auth/ChangePasswordIcon.svg";
import DeleteIcon from "../assets/DeleteIcon.svg";
import DeleteAccountCardIcon from "../assets/delete-account-card.svg";
import PasswordBannerStar from "../assets/password-banner-star.svg";
import SubscriptionIcon from "../assets/SubscriptionIcon.svg";
import PremiumIcon from "../assets/PremiumIcon.svg";
import tokenIcon from "../assets/token.svg";
import { buildApiUrl } from "../utils/apiBase";
import fetchWithAuth from "../utils/fetchWithAuth";
import { useToastActions } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/api";
import { IconSpinner } from "../utils/chatUtils";

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

const ChevronDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="opacity-90">
    <rect x="5" y="7" width="14" height="14" rx="2.2" stroke="#ff6b6b" strokeWidth="1.6" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="#ff6b6b" strokeWidth="1.6" />
    <path d="M4 7h16" stroke="#ff6b6b" strokeWidth="1.6" />
  </svg>
);

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-sm font-medium text-white/70">{children}</div>;
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
        className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 pr-10 text-sm text-white placeholder:text-white/25 focus:border-[#7F5AF0]/50 focus:bg-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-left text-sm text-white transition focus:border-[#7F5AF0]/50 focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between">
          <span>{value}</span>
          <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-[14px] border border-white/10 bg-[#17141F] shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full px-5 py-3 text-left text-[18px] text-white transition ${opt === value ? "bg-white/8" : "hover:bg-white/6"} ${i !== 0 ? "border-t border-white/5" : ""}`}
              role="option"
              aria-selected={opt === value}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [view, setView] = useState<"calendar" | "year" | "month">("calendar");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = useMemo(() => Array.from({ length: 120 }).map((_, i) => new Date().getFullYear() - i), []);

  const days = useMemo(() => {
    const s = startOfMonth(cursor);
    const firstDay = new Date(s);
    firstDay.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    const e = endOfMonth(cursor);
    const firstIdx = (s.getDay() + 6) % 7;
    const total = firstIdx + e.getDate();
    return Array.from({ length: Math.ceil(total / 7) * 7 }).map((_, i) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + i);
      return {
        label: String(date.getDate()),
        date,
        inMonth: date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear(),
      } as { label: string; date: Date; inMonth: boolean };
    });
  }, [cursor]);

  return (
    <div className="relative">
      <Input
        value={formatDate(value)}
        onChange={() => {}}
        placeholder="DD-MM-YYYY"
        right={
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              setView("calendar");
            }}
            className="p-1"
          >
            <CalendarIcon />
          </button>
        }
      />
      {open && (
        <div className="absolute z-20 mt-2 w-[320px] rounded-[18px] border border-white/10 bg-[#17141F] p-4 shadow-[0_30px_84px_rgba(19,10,46,0.08),0_8px_32px_rgba(19,10,46,0.07),0_3px_14px_rgba(19,10,46,0.03),0_1px_3px_rgba(19,10,46,0.13)]">
          {view === "calendar" && (
            <>
              <div className="mb-3 flex items-center justify-between text-white">
                <button
                  className="px-2 text-lg text-white/90 transition hover:text-white"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="flex items-center gap-2 font-semibold">
                  <button
                    type="button"
                    onClick={() => setView("year")}
                    className="rounded px-2 py-1 text-[14px] leading-6 text-white hover:bg-white/5"
                  >
                    {cursor.getFullYear()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className="rounded px-2 py-1 text-[14px] leading-6 text-white hover:bg-white/5"
                  >
                    {cursor.toLocaleString(undefined, { month: "long" })}
                  </button>
                </div>
                <button
                  className="px-2 text-lg text-white/90 transition hover:text-white"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-white/60">
                {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                  const isSelected = formatDate(d.date) === formatDate(value);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onChange(d.date);
                        setOpen(false);
                        setView("calendar");
                      }}
                      className={`h-8 rounded-md text-sm transition ${
                        isSelected
                          ? "bg-[#7F5AF0] font-semibold text-white"
                          : d.inMonth
                            ? "bg-transparent text-white hover:bg-white/10"
                            : "bg-transparent text-white/35 hover:bg-transparent hover:text-white/50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === "year" && (
            <div className="overflow-hidden rounded-[8px] bg-black py-2">
              <div className="max-h-[392px] overflow-y-auto">
                {years.map((year) => {
                  const selected = year === cursor.getFullYear();
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setCursor(new Date(year, cursor.getMonth(), 1));
                        setView("month");
                      }}
                      className={`block w-full px-4 py-1 text-left leading-6 ${
                        selected ? "bg-[#7F5AF0] text-[14px] font-semibold text-white" : "text-[14px] font-normal text-white hover:bg-white/6"
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "month" && (
            <div className="overflow-hidden rounded-[8px] bg-black py-2">
              {months.map((month, index) => {
                const selected = index === cursor.getMonth();
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setCursor(new Date(cursor.getFullYear(), index, 1));
                      setView("calendar");
                    }}
                    className={`block w-full px-4 py-1 text-left leading-6 ${
                      selected ? "bg-[#7F5AF0] text-[14px] font-semibold text-white" : "text-[14px] font-normal text-[#F2F2F2] hover:bg-white/6"
                    }`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default function Profile() {
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [passSuccessOpen, setPassSuccessOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [tokensAvailable, setTokensAvailable] = useState<number | null>(null);
  const [passLoading, setPassLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [birthError, setBirthError] = useState<string | null>(null);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showError, showSuccess } = useToastActions();
  const { token, user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const PASS_REGEX = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]{8,15}$/;

  useEffect(() => {
    void fullName;
    void profileId;
    void setProfileId;
    void setAvatarHue;
  }, [fullName, profileId]);

  function parseIso(d?: string | null) {
    if (!d) return null;
    const t = Date.parse(d);
    if (Number.isNaN(t)) return null;
    return new Date(t);
  }

  useEffect(() => {
    if (!birth) {
      setBirthError(null);
      return;
    }
    const now = new Date();
    const age =
      now.getFullYear() -
      birth.getFullYear() -
      (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate()) ? 1 : 0);
    setBirthError(age < 18 ? "You must be at least 18 years old." : null);
  }, [birth]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { state: { from: location } });
    }
  }, [token, navigate, location]);

  async function fetchSubscriptionDetails() {
    const url = buildApiUrl("/api/v1/tagada/subscription/me");
    setSubscriptionLoading(true);
    try {
      const res = await fetchWithAuth(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return;
      const data = await res.json();
      setSubscriptionDetails(data);
    } catch (err) {
      console.error("fetchSubscriptionDetails", err);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function fetchProfile() {
    const url = buildApiUrl("/user/get-profile");
    try {
      setLoading(true);
      const res = await fetchWithAuth(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to fetch profile");

      setEmail(data.email ?? "");
      setUsername(data.username ?? "");
      setFullName(data.full_name ?? "");
      setGender(data.gender ?? gender);
      setBirth(parseIso(data.birth_date));
      setProfileImageUrl(data.profile_image_url ?? null);
      setProfileId(data.profile_id ?? null);

      const tokens = data.total_coins ?? data.coins ?? data.tokens ?? data.wallet?.coins ?? data.wallet?.balance ?? data.available_coins ?? null;
      setTokensAvailable(typeof tokens === "number" ? tokens : tokens ? Number(tokens) : null);

      try {
        if (typeof setUser === "function") {
          (setUser as any)((prev: any) => ({
            ...(prev || {}),
            name: data.full_name || data.name || prev?.name,
            email: data.email ?? prev?.email,
            avatar: data.profile_image_url || data.profile_image || prev?.avatar || null,
            role: data.user_role || data.role || prev?.role,
            hasActiveSubscription: data.hasActiveSubscription ?? prev?.hasActiveSubscription ?? false,
            tokenBalance: Number((data.tokenBalance ?? data.coins ?? data.tokens ?? prev?.tokenBalance) || 0),
          }));
        }
      } catch {}

      await fetchSubscriptionDetails();
    } catch (err) {
      console.error("fetchProfile", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
    fetchSubscriptionDetails();
    const id = setInterval(() => {
      fetchProfile();
      fetchSubscriptionDetails();
    }, 15000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    try {
      fetchSubscriptionDetails();
    } catch {}
  }, [(user as any)?.hasActiveSubscription, token]);

  async function submitProfileUpdate() {
    if (birthError) {
      try { showError(birthError); } catch {}
      return;
    }

    const url = buildApiUrl("/user/add-update-profile");
    const fd = new FormData();
    if (fullName) fd.append("full_name", fullName);
    if (email) fd.append("email", email);
    if (username) fd.append("username", username);
    if (gender) fd.append("gender", gender);
    if (birth) fd.append("birth_date", birth.toISOString());
    if (selectedFile) fd.append("file", selectedFile);

    try {
      setLoading(true);
      const res = await fetchWithAuth(url, {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const body = json ?? null;
        const message = body ? (typeof body === "string" ? body : JSON.stringify(body)) : res.statusText || `HTTP ${res.status}`;
        const e: any = new Error(message);
        e.status = res.status;
        e.body = body;
        throw e;
      }

      await fetchProfile();
      setSuccessOpen(true);
      setTimeout(() => setSuccessOpen(false), 2000);
      setSelectedFile(null);
      if (selectedPreview) {
        try { URL.revokeObjectURL(selectedPreview); } catch {}
        setSelectedPreview(null);
      }
      try { localStorage.setItem("hl_gender", gender); } catch {}
    } catch (err: any) {
      console.error(err);
      try {
        const status = typeof err.status === "number" ? err.status : err?.status || 0;
        if (status >= 400 && status < 500) {
          const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
          showError("Failed to update profile", detail);
        } else if (status >= 500) {
          showError("Failed to update profile", "Unable to update your profile right now.");
        } else {
          showError("Failed to update profile", getErrorMessage(err));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
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

    const url = buildApiUrl("/auth/change-password");
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
        const message = body ? (typeof body === "string" ? body : JSON.stringify(body)) : res.statusText || `HTTP ${res.status}`;
        const e: any = new Error(message);
        e.status = res.status;
        e.body = body;
        throw e;
      }

      setPassSuccessOpen(true);
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
      setTimeout(() => setPassSuccessOpen(false), 2000);
    } catch (err: any) {
      console.error("changePassword", err);
      try {
        const status = typeof err.status === "number" ? err.status : err?.status || 0;
        if (status >= 400 && status < 500) {
          const detail = err?.body?.detail ?? err?.body?.message ?? err?.detail ?? err?.message ?? getErrorMessage(err);
          showError("Unable to change password", detail);
        } else if (status >= 500) {
          showError("Unable to change password", "Unable to change password right now.");
        } else {
          showError("Unable to change password", getErrorMessage(err));
        }
      } catch {}
    } finally {
      setPassLoading(false);
    }
  }

  const panelClass =
    "overflow-hidden rounded-2xl border border-white/5 bg-[linear-gradient(180deg,rgba(20,17,29,0.98)_0%,rgba(15,12,22,0.98)_55%,rgba(72,18,49,0.72)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.28)]";
  const sectionHeadingClass = "text-lg font-bold uppercase tracking-wider text-[#7F5AF0]";
  const primaryButtonStyle: React.CSSProperties = {
    borderRadius: 60,
    border: "1px solid rgba(255,255,255,0.40)",
    background: "linear-gradient(180deg, #7F5AF0 3.02%, #E53170 98.45%)",
    boxShadow: "0 8px 16px rgba(127,90,240,0.12)",
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-8 pt-4 md:px-6 md:pt-6">
      <h1 className="text-2xl font-bold text-white md:text-3xl">Profile</h1>

      <div className="mt-8 space-y-6">
        <section>
          <p className={sectionHeadingClass}>Personal information</p>
          <div className={`${panelClass} mt-4 overflow-visible px-6 py-6 md:px-8 md:py-8`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="shrink-0 self-center lg:self-start">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  className="h-40 w-40 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
                  title="Click to upload avatar"
                >
                  {selectedPreview ? (
                    <img src={selectedPreview} alt="avatar preview" className="h-full w-full object-cover" />
                  ) : profileImageUrl ? (
                    <img src={profileImageUrl} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      style={{ background: `linear-gradient(135deg, hsla(${avatarHue},80%,60%,0.35), rgba(255,255,255,0.04))` }}
                      className="h-full w-full"
                    />
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
              </div>

              <div className="min-w-0 flex-1">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Label>Email Id</Label>
                    <Input value={email} onChange={setEmail} disabled />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <Input value={username} onChange={setUsername} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={gender} onChange={setGender} options={["Male", "Female", "Trans"]} />
                  </div>
                  <div className="relative z-30">
                    <Label>Birth Date</Label>
                    <DatePicker value={birth} onChange={setBirth} />
                    {birthError && <div className="mt-2 text-sm text-rose-400">{birthError}</div>}
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    onClick={submitProfileUpdate}
                    variant="primary"
                    className="h-11 w-full max-w-[240px] justify-center gap-2 text-sm font-semibold text-white"
                    style={primaryButtonStyle}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <IconSpinner className="h-4 w-4 animate-spin" />
                        Updating...
                      </span>
                    ) : (
                      <>
                        <img src={ChangePasswordIcon} alt="" className="h-5 w-5" aria-hidden />
                        <span>Update Profile</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
          <section>
            <p className={sectionHeadingClass}>Password</p>
            <div className={`${panelClass} mt-4 px-5 py-5 md:px-6 md:py-6`}>
              <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,#7F5AF0_3.02%,#E53170_98.45%)] px-5 py-3">
                <div className="flex items-center gap-4">
                  <img src={PasswordBannerStar} alt="" className="h-[42px] w-[42px]" aria-hidden />
                  <p className="max-w-[430px] text-sm leading-6 text-white">
                    set a new password for this account. Feel free to do so if you wish to use standard email/password login.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div>
                  <Label>Old Password</Label>
                  <PasswordInput value={oldPass} onChange={setOldPass} placeholder="Enter old password" />
                </div>
                <div>
                  <Label>New Password</Label>
                  <PasswordInput value={newPass} onChange={setNewPass} placeholder="Enter new password" />
                </div>
                <div>
                  <Label>Confirm new Password</Label>
                  <PasswordInput value={confirmPass} onChange={setConfirmPass} placeholder="Confirm new password" />
                </div>
              </div>

              <div className="mt-6">
                <Button
                  variant="primary"
                  className="h-11 w-full max-w-[240px] justify-center gap-2 text-sm font-semibold text-white"
                  onClick={handleChangePassword}
                  style={primaryButtonStyle}
                  disabled={passLoading}
                >
                  {passLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <IconSpinner className="h-4 w-4 animate-spin" />
                      Changing...
                    </span>
                  ) : (
                    <>
                      <img src={ChangePasswordIcon} alt="" className="h-5 w-5" aria-hidden />
                      <span>Change Password</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>

          <section>
            <p className={sectionHeadingClass}>Delete Account</p>
            <div className={`${panelClass} mt-4 flex min-h-[380px] flex-col items-center justify-center px-6 py-8 text-center md:px-8`}>
              <div className="rounded-2xl bg-white/5 p-4">
                <img src={DeleteAccountCardIcon} alt="delete icon" className="h-12 w-12" />
              </div>
              <p className="mt-6 max-w-[400px] text-sm leading-relaxed text-white/70">
                You have an option to delete your account, but beware,{" "}
                <span className="text-[#E53170]">you will not be able to access it</span> if you proceed.
              </p>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="mt-6 h-11 w-full max-w-[240px] rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Delete Account
              </button>
            </div>
          </section>
        </div>

        {user && (
          <section
            className="overflow-hidden rounded-2xl border border-white/10 px-6 py-6"
            style={{ background: "linear-gradient(180deg, #7F5AF0 3.02%, #E53170 98.45%)" }}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <img src={SubscriptionIcon} alt="Subscription" className="h-12 w-12" />
                </div>
                <div className="max-w-[860px] text-white">
                  <h3 className="text-lg font-bold uppercase tracking-tight">Subscription</h3>
                  {subscriptionLoading ? (
                    <p className="mt-1 text-sm text-white/80">Loading subscription details...</p>
                  ) : subscriptionDetails || (user as any).hasActiveSubscription ? (
                    <div className="mt-1 space-y-0.5 text-sm text-white/90">
                      <p>
                        {subscriptionDetails?.status === "expired"
                          ? "Your subscription has expired. Renew to continue enjoying premium benefits."
                          : `Plan: ${subscriptionDetails?.plan_name || "Premium"}${subscriptionDetails?.billing_cycle ? ` \u2022 ${subscriptionDetails.billing_cycle}` : ""}`}
                      </p>
                      {subscriptionDetails?.current_period_end && (
                        <p>
                          Next Billing Date:{" "}
                          {new Date(subscriptionDetails.current_period_end).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      {tokensAvailable !== null && <p>Available Tokens: {tokensAvailable.toLocaleString()}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-white/90">
                      You are not subscribed to our premium plan. Subscribe to get access to all features.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(subscriptionDetails || (user as any).hasActiveSubscription ? "/buy-tokens" : "/premium")}
                className="flex h-11 w-full max-w-[240px] items-center justify-center gap-2 rounded-full border border-white/20 bg-white px-6 text-sm font-bold text-[#E53170] shadow-lg transition hover:bg-white/90"
              >
                <img
                  src={subscriptionDetails || (user as any).hasActiveSubscription ? tokenIcon : PremiumIcon}
                  alt=""
                  className="h-4 w-4"
                  aria-hidden
                />
                <span>{subscriptionDetails || (user as any).hasActiveSubscription ? "Buy Tokens" : "Upgrade Now"}</span>
              </button>
            </div>
          </section>
        )}
      </div>
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "linear-gradient(135deg,#431417,#1a0b0c)" }}>
            <TrashIcon />
          </div>
          <div className="text-2xl font-bold text-white">Delete Account</div>
          <p className="max-w-md text-white/80">After deleting your account you have 30 days to reactivate or it will be definitive.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button className="rounded-full bg-white/10 px-6 py-3 text-white/90 ring-1 ring-white/10 hover:bg-white/15" onClick={() => setConfirmOpen(false)} disabled={deleteLoading}>
              Cancel
            </button>
            <button
              className="rounded-full bg-[#7F5AF0] px-6 py-3 text-white"
              onClick={async () => {
                try {
                  setDeleteLoading(true);
                  const url = buildApiUrl("/user/delete-account");
                  const res = await fetchWithAuth(url, {
                    method: "POST",
                    credentials: "include",
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  });
                  if (res && res.ok) {
                    setConfirmOpen(false);
                    try { showSuccess("Account scheduled for deletion"); } catch {}
                  } else {
                    let body = null;
                    try { body = await res?.json().catch(() => null); } catch {}
                    const msg = body?.message || body?.detail || res?.statusText || `HTTP ${res?.status}`;
                    try { showError("Unable to delete account", msg as string); } catch {}
                  }
                } catch (err) {
                  console.error("deleteAccount", err);
                  try { showError("Unable to delete account", "Request failed"); } catch {}
                } finally {
                  setDeleteLoading(false);
                }
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <span className="inline-flex items-center gap-2">
                  <IconSpinner className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Yes Delete"
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#7F5AF0] text-2xl text-white">âœ“</div>
          <div className="text-xl font-semibold text-white">Profile updated</div>
          <div className="text-sm text-white/80">Your profile was updated successfully.</div>
          <button className="mt-2 rounded-full bg-white/10 px-6 py-2 hover:bg-white/15" onClick={() => setSuccessOpen(false)}>
            Close
          </button>
        </div>
      </Modal>

      <Modal open={passSuccessOpen} onClose={() => setPassSuccessOpen(false)}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#7F5AF0] text-2xl text-white">âœ“</div>
          <div className="text-xl font-semibold text-white">Password changed</div>
          <div className="text-sm text-white/80">Your password was changed successfully.</div>
          <button className="mt-2 rounded-full bg-white/10 px-6 py-2 hover:bg-white/15" onClick={() => setPassSuccessOpen(false)}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}


