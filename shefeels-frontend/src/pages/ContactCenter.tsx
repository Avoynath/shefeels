import React, { useState } from "react";
import { useToastActions } from "../contexts/ToastContext";
import EmailIcon from "../assets/contact/EmailIcon.svg";
import PhoneIcon from "../assets/contact/PhoneIcon.svg";
import AddressIcon from "../assets/contact/AddressIcon.svg";
import { useThemeStyles } from "../utils/theme";
import Button from "../components/Button";
import sendIcon from "../assets/contact/SendMessageContactUsIcon.svg";
import { buildApiUrl } from "../utils/apiBase";
import fetchWithAuth from "../utils/fetchWithAuth";

export default function ContactCenter() {
  useThemeStyles();

  const [interest, setInterest] = useState("General Support");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showError, showSuccess } = useToastActions();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name || !message) {
      showError("Form incomplete", "Please fill in your name, email and message.");
      return;
    }
    setIsSubmitting(true);
    try {
      const url = buildApiUrl("/support/contact");
      const res = await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest, email, name, subject: subject || interest, message }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      showSuccess("Message sent", "We'll get back to you shortly.");
      setInterest("General Support");
      setEmail("");
      setName("");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("Contact submit failed", err);
      showError("Submission failed", "Please email support@honeylove.ai directly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClassName =
    "mt-2 h-[68px] rounded-[18px] border border-white/20 bg-[rgba(255,255,255,0.06)] px-5 text-[16px] text-white placeholder:text-white/45 outline-none transition focus:border-white/35 focus:bg-[rgba(255,255,255,0.1)]";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-8">
      <div className="overflow-hidden rounded-[22px] border border-[rgba(129,92,240,0.45)] bg-[radial-gradient(circle_at_20%_100%,rgba(93,24,45,0.55),transparent_35%),linear-gradient(180deg,rgba(26,20,35,0.98)_0%,rgba(11,11,14,0.98)_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="grid grid-cols-1 gap-8 px-6 py-7 sm:px-10 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-12 lg:py-14">
          <section className="flex flex-col">
            <div>
              <div className="max-w-[470px] text-[42px] font-semibold leading-[1.18] text-white sm:text-[56px]">
                Let&apos;s discuss
                <br />
                on <span className="text-[#815CF0]">something cool</span>
                <br />
                together
              </div>
            </div>

            <div className="mt-8 space-y-8 sm:mt-12">
              <div className="flex items-center gap-4 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[#815CF0]">
                  <img src={EmailIcon} alt="email" className="h-5 w-5" />
                </div>
                <span className="text-[20px] font-medium tracking-[-0.01em]">support@honeylove.ai</span>
              </div>

              <div className="flex max-w-[380px] items-center gap-4 rounded-[16px] border border-[rgba(129,92,240,0.78)] bg-transparent px-[6px] py-5 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[#815CF0]">
                  <img src={PhoneIcon} alt="phone" className="h-5 w-5" />
                </div>
                <span className="text-[18px] font-medium">+123 456 789</span>
              </div>

              <div className="flex items-center gap-4 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[#815CF0]">
                  <img src={AddressIcon} alt="address" className="h-5 w-5" />
                </div>
                <span className="text-[20px] font-medium tracking-[-0.01em]">123 Street 456 House</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-[linear-gradient(180deg,#7B57F0_0%,#A75DE6_38%,#F03078_100%)] p-6 shadow-[0_24px_80px_rgba(129,92,240,0.3)] sm:p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="flex flex-col">
                <span className="mb-2 text-[16px] font-medium text-white">I&apos;m interested in...</span>
                <select
                  className={fieldClassName}
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  required
                >
                  <option value="SEO" className="text-black">SEO</option>
                  <option value="General Support" className="text-black">General Support</option>
                  <option value="Billing" className="text-black">Billing</option>
                  <option value="Partnerships" className="text-black">Partnerships</option>
                  <option value="Press" className="text-black">Press</option>
                </select>
              </label>

              <label className="flex flex-col">
                <span className="mb-2 text-[16px] font-medium text-white">Email Id</span>
                <input
                  className={fieldClassName}
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>

              <label className="flex flex-col">
                <span className="mb-2 text-[16px] font-medium text-white">Name</span>
                <input
                  className={fieldClassName}
                  placeholder="Enter name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="flex flex-col">
                <span className="mb-2 text-[16px] font-medium text-white">Message</span>
                <textarea
                  rows={3}
                  className="mt-0 min-h-[132px] rounded-[18px] border border-white/20 bg-[rgba(255,255,255,0.06)] px-5 py-5 text-[16px] text-white placeholder:text-white/45 outline-none transition focus:border-white/35 focus:bg-[rgba(255,255,255,0.1)]"
                  placeholder="Enter email"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </label>
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-w-[268px] items-center justify-center gap-4 rounded-[16px] border-none bg-white px-10 py-5"
                  style={{ color: "#111111" }}
                >
                  <span className="text-[18px] font-medium text-black">{isSubmitting ? "Sending..." : "Send Message"}</span>
                  <img src={sendIcon} alt="send" className="h-5 w-5 brightness-0" />
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
