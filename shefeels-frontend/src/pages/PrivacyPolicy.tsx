import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import Card from "../components/Card";

// Helper components for theme-aware styling
function BodyText({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <div className={`space-y-4 text-sm leading-relaxed ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </div>
  );
}

function BodyList({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <ul className={`list-disc pl-5 space-y-2 text-sm ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </ul>
  );
}

type Section = { id: string; title: string; body: React.ReactNode };

const effectiveDate = "March 17, 2026";

const sections: Section[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    body: (
      <BodyText>
        <p>JLHL MANAGEMENT LTD (Registration Number HE 484306), a company incorporated in the Republic of Cyprus with its registered office at Georgiou Karaiskaki, 11-13, Carisa Salonica Court, Office 102, 7560, Pervolia, Larnaca, Cyprus, is the data controller for personal data processed through shefeels.ai ("Platform", "Service", "we", "us", or "our").</p>
        <p>This Privacy Policy explains how we collect, use, store, share, and protect your personal data when you use our Service. We are committed to processing your data in compliance with the General Data Protection Regulation (EU) 2016/679 ("GDPR"), the Cyprus Law 125(I)/2018 on the Protection of Natural Persons with Regard to the Processing of Personal Data, and the California Consumer Privacy Act ("CCPA").</p>
        <p>By accessing or using shefeels.ai, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with our data practices, please do not use the Service.</p>
      </BodyText>
    ),
  },
  {
    id: "data-we-collect",
    title: "2. Data We Collect",
    body: (
      <BodyText>
        <p><strong>2.1 Data You Provide to Us</strong></p>
        <BodyList>
          <li>Email address</li>
          <li>Username</li>
          <li>Password (stored in hashed form only)</li>
          <li>Date of birth</li>
          <li>Payment data (processed and stored by third-party payment processors; we do not store full payment details on our servers)</li>
          <li>Support messages and communications</li>
          <li>Chat messages you send to AI companions</li>
        </BodyList>
        <p><strong>2.2 Data Collected Automatically</strong></p>
        <BodyList>
          <li>IP address</li>
          <li>Browser type and version</li>
          <li>Operating system</li>
          <li>Device information</li>
          <li>Usage data (pages visited, features used, interaction patterns)</li>
          <li>Cookies and similar tracking technologies</li>
          <li>Referral URL</li>
        </BodyList>
        <p><strong>2.3 Service-Generated Data</strong></p>
        <BodyList>
          <li>AI memory data (encrypted at rest and in transit)</li>
          <li>Preference data derived from your interactions</li>
          <li>AI-generated content (text, images, and video produced during your sessions)</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "legal-bases",
    title: "3. Legal Bases for Processing",
    body: (
      <BodyText>
        <p>In accordance with GDPR Article 6, we process your personal data on the following legal bases:</p>
        <BodyList>
          <li><strong>Performance of a Contract (Art. 6(1)(b)):</strong> Processing necessary to provide the Service, manage your account, process payments, and deliver AI companion features.</li>
          <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> Processing necessary for fraud prevention, security, service improvement, and analytics, where our interests do not override your fundamental rights and freedoms.</li>
          <li><strong>Consent (Art. 6(1)(a)):</strong> Processing based on your explicit consent, including marketing communications and non-essential cookies. You may withdraw consent at any time.</li>
          <li><strong>Legal Obligation (Art. 6(1)(c)):</strong> Processing necessary to comply with applicable legal requirements, including tax obligations, fraud reporting, and law enforcement requests.</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "how-we-use",
    title: "4. How We Use Your Data",
    body: (
      <BodyText>
        <p>We use the personal data we collect for the following purposes:</p>
        <BodyList>
          <li>Providing, operating, and maintaining the Service</li>
          <li>Creating and managing your account</li>
          <li>Processing payments and subscriptions</li>
          <li>Powering AI companion features, including conversation, memory, and personalized interactions</li>
          <li>Personalizing your experience and improving the Service</li>
          <li>Communicating with you about your account, support requests, and service updates</li>
          <li>Detecting, preventing, and addressing fraud, abuse, and security issues</li>
          <li>Complying with legal obligations and regulatory requirements</li>
          <li>Sending marketing communications (only with your explicit consent; you may opt out at any time)</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "data-sharing",
    title: "5. Data Sharing",
    body: (
      <BodyText>
        <p>We do NOT sell your personal data to third parties.</p>
        <p>We may share your data with the following categories of recipients, strictly as necessary:</p>
        <BodyList>
          <li><strong>Payment Processors:</strong> CCBill and BTCPay Server, for processing subscription and one-time payments.</li>
          <li><strong>Cloud Infrastructure:</strong> Amazon Web Services (AWS), for hosting, storage, and computing services.</li>
          <li><strong>Email Services:</strong> Resend.com, for transactional and service-related email communications.</li>
          <li><strong>Analytics:</strong> Privacy-focused analytics tools only. We do not use Google Analytics or any analytics service that tracks users across third-party websites.</li>
          <li><strong>Legal Authorities:</strong> Law enforcement or regulatory bodies when required by applicable law or to protect our legal rights.</li>
          <li><strong>Professional Advisors:</strong> Legal, accounting, and other professional advisors as necessary for our business operations.</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "international-transfers",
    title: "6. International Transfers",
    body: (
      <BodyText>
        <p>Your personal data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States (for AWS cloud infrastructure). When such transfers occur, we ensure appropriate safeguards are in place, including:</p>
        <BodyList>
          <li>European Commission adequacy decisions</li>
          <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
          <li>Data Processing Agreements (DPAs) with all service providers</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "data-retention",
    title: "7. Data Retention",
    body: (
      <BodyText>
        <p>We retain your personal data only for as long as necessary to fulfill the purposes described in this Privacy Policy, unless a longer retention period is required by law:</p>
        <BodyList>
          <li><strong>Account Data:</strong> Retained for the duration of your account plus 12 months after account deletion.</li>
          <li><strong>Payment Records:</strong> Retained for 7 years in compliance with Cyprus tax law.</li>
          <li><strong>Conversations and AI Memory:</strong> Retained for the duration of your account. Deleted within 30 days of account deletion.</li>
          <li><strong>Server Logs:</strong> Retained for 12 months.</li>
          <li><strong>Marketing Consent Records:</strong> Retained for the duration of consent validity plus 3 years.</li>
        </BodyList>
      </BodyText>
    ),
  },
  {
    id: "gdpr-rights",
    title: "8. Your Rights Under GDPR",
    body: (
      <BodyText>
        <p>Under the GDPR (Articles 15–21 and Article 7(3)), you have the following rights regarding your personal data:</p>
        <BodyList>
          <li><strong>Right of Access (Art. 15):</strong> You have the right to obtain confirmation...</li>
          <li><strong>Right to Rectification (Art. 16):</strong> You have the right to request correction...</li>
          <li><strong>Right to Erasure (Art. 17):</strong> You have the right to request deletion...</li>
          <li>...and more. Please contact privacy@shefeels.ai for the full list.</li>
        </BodyList>
        <p>To exercise any of these rights, please contact us at <a className="underline" href="mailto:privacy@shefeels.ai">privacy@shefeels.ai</a>. We will respond to your request within 30 days.</p>
        <p>Right to Lodge a Complaint: You have the right to lodge a complaint with the Cyprus Commissioner for the Protection of Personal Data at <a className="underline" href="https://www.dataprotection.gov.cy" target="_blank" rel="noreferrer">www.dataprotection.gov.cy</a>.</p>
      </BodyText>
    ),
  },
  {
    id: "ccpa-rights",
    title: "9. Your Rights Under CCPA",
    body: (
      <BodyText>
        <p>If you are a California resident, you have the right to know what data we collect, request deletion, and opt-out of sales (though we do not sell data).</p>
        <p>To exercise your CCPA rights, please contact us at <a className="underline" href="mailto:privacy@shefeels.ai">privacy@shefeels.ai</a>.</p>
      </BodyText>
    ),
  },
  {
    id: "children-privacy",
    title: "10. Children’s Privacy",
    body: (
      <BodyText>
        <p>shefeels.ai is not intended for use by anyone under the age of 18. We do not knowingly collect personal data from individuals under 18 years of age. If we become aware that we have collected personal data from a person under 18, we will take immediate steps to delete that data and terminate the associated account.</p>
      </BodyText>
    ),
  },
  {
    id: "security-measures",
    title: "11. Security Measures",
    body: (
      <BodyText>
        <p>We implement robust technical and organizational measures to protect your personal data, including TLS 1.2+ encryption, AES-256 encryption at rest, and regular security audits.</p>
      </BodyText>
    ),
  },
  {
    id: "changes",
    title: "12. Changes to This Policy",
    body: (
      <BodyText>
        <p>We may update this Privacy Policy from time to time. For material changes, we will provide you with at least 30 days’ prior notice.</p>
      </BodyText>
    ),
  },
  {
    id: "contact",
    title: "13. Contact Information",
    body: (
      <BodyText>
        <p>For any questions or concerns about this Privacy Policy, please contact our Data Protection Officer:</p>
        <div>
          <strong>JLHL MANAGEMENT LTD</strong><br />
          Georgiou Karaiskaki, 11-13, Carisa Salonica Court, Office 102, 7560, Pervolia, Larnaca, Cyprus<br />
          Email: <a className="underline" href="mailto:privacy@shefeels.ai">privacy@shefeels.ai</a>
        </div>
      </BodyText>
    ),
  },
];

export default function PrivacyPolicy() {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>Privacy Policy</h1>
          <p className={sub}>Last updated: {effectiveDate}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 space-y-6">
          <Card>
            <div className="space-y-8">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="space-y-3">
                  <h2 className={`text-lg sm:text-xl font-semibold tracking-tight ${
                    isDark ? "text-[#B8A3F6]" : "text-[#7B57F0]"
                  }`}>{s.title}</h2>
                  {s.body}
                </section>
              ))}
            </div>
          </Card>
        </main>

        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}>On this page</h3>
            </div>
            <nav className="mt-4 grid gap-2">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  isDark 
                    ? "text-white/80 ring-white/10 hover:ring-white/25 hover:bg-white/5" 
                    : "text-gray-600 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50"
                }`}>
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>
        </aside>
      </div>
    </div>
  );
}
