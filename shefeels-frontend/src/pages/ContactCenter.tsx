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
      showError("Submission failed", "Please email support@shefeels.ai directly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClassName =
    "mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#7f5af0]/50 focus:bg-white/10 focus:ring-1 focus:ring-[#7f5af0]/30";

  return (
    <div className="mx-auto w-full max-w-6xl px-1 sm:px-4 md:px-0 pt-2 pb-8 sm:pt-4 sm:pb-12 md:pb-20">
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-md">
        <div className="rounded-[20px] bg-black/60 p-1 sm:p-3 ring-1 ring-white/5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 sm:p-8 lg:p-12">
            {/* Left Column: Info */}
            <section className="lg:col-span-6 flex flex-col justify-center">
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white">
                  Connect with
                  <br />
                  <span className="bg-gradient-to-r from-[#B8A3F6] to-[#E53170] bg-clip-text text-transparent">SheFeels AI</span>
                  <br />
                  Support
                </h1>
                <p className="mt-4 text-sm text-white/60 max-w-md">
                  We're here to help you get the most out of your AI experience. Reach out with any questions or feedback.
                </p>
              </div>

              <div className="mt-8 space-y-6 sm:mt-12">
                <div className="flex items-center gap-4 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7f5af0]/10 border border-[#7f5af0]/20 text-[#B8A3F6]">
                    <img src={EmailIcon} alt="email" className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Email Us</div>
                    <span className="text-lg font-medium text-white/90">support@shefeels.ai</span>
                  </div>
                </div>

                <div className="flex items-start gap-4 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7f5af0]/10 border border-[#7f5af0]/20 text-[#B8A3F6]">
                    <img src={AddressIcon} alt="address" className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Registered Office</div>
                    <span className="text-sm font-semibold text-white">JLHL MANAGEMENT LTD</span>
                    <span className="text-xs text-white/60 leading-relaxed mt-1">
                      Georgiou Karaiskaki 11-13,<br />
                      Carisa Salonica Court, Office 102,<br />
                      7560 Pervolia, Larnaca, Cyprus
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column: Form */}
            <section className="lg:col-span-6 lg:ml-auto w-full max-w-md">
              <div className="rounded-[24px] bg-gradient-to-b from-white/10 to-transparent p-[1px]">
                <div className="rounded-[24px] bg-[#0d0d0d] p-6 sm:p-8">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <label className="flex flex-col">
                      <span className="text-xs font-semibold text-white/50 px-1 uppercase tracking-wider">Interested in...</span>
                      <select
                        className={fieldClassName}
                        value={interest}
                        onChange={(e) => setInterest(e.target.value)}
                        required
                      >
                        <option value="General Support" className="text-black">General Support</option>
                        <option value="Billing" className="text-black">Billing</option>
                        <option value="Partnerships" className="text-black">Partnerships</option>
                        <option value="Press" className="text-black">Press</option>
                        <option value="Technical" className="text-black">Technical Issue</option>
                      </select>
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs font-semibold text-white/50 px-1 uppercase tracking-wider">Email</span>
                      <input
                        className={fieldClassName}
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        required
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs font-semibold text-white/50 px-1 uppercase tracking-wider">Name</span>
                      <input
                        className={fieldClassName}
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs font-semibold text-white/50 px-1 uppercase tracking-wider">Message</span>
                      <textarea
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#7f5af0]/50 focus:bg-white/10"
                        placeholder="How can we help you?"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                      />
                    </label>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-3 rounded-xl py-4 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ 
                          background: 'linear-gradient(90deg, #7F5AF0 0%, #9D66FF 100%)',
                          color: 'white' 
                        }}
                      >
                        <span className="text-sm font-bold uppercase tracking-widest">
                          {isSubmitting ? "Sending..." : "Send Message"}
                        </span>
                        <img src={sendIcon} alt="send" className="h-4 w-4 brightness-0 invert" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-center text-white/30 mt-4">
                      By contact us, you agree to our Terms of Service and Privacy Policy.
                    </p>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
