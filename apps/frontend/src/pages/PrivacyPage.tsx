// pages/PrivacyPage.tsx — Privacy Policy (Phase 15)
// Public route, no auth required.
// Third-party processor details reflect actual infrastructure as of v2.14.0.
// Sections marked [PLACEHOLDER] require legal review before launch.

import { useNavigate } from 'react-router-dom'

export default function PrivacyPage(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-brand-primary text-gray-300 px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-widest mb-8 flex items-center gap-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="font-display text-3xl uppercase tracking-wide text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-gray-500 mb-10">Last updated: [DATE — PLACEHOLDER]</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">1. What we collect</h2>
            <p className="mb-3">When you create an account, we collect:</p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400">
              <li><strong className="text-gray-200">Account data</strong> — your name, email address, and password. Passwords are hashed using argon2id and never stored in plaintext.</li>
              <li><strong className="text-gray-200">Training data</strong> — sessions, workouts, exercises, sets, templates, and the targets and results you record.</li>
              <li><strong className="text-gray-200">Progress data</strong> — goals, body composition snapshots, subjective scores, and progress photos you choose to upload.</li>
              <li><strong className="text-gray-200">Client data (Trainer accounts only)</strong> — profiles, goals, and training history for clients you add to your roster.</li>
              <li><strong className="text-gray-200">Device data</strong> — a device identifier used to manage active sessions and refresh token security. Not tied to hardware — generated per browser/device.</li>
              <li><strong className="text-gray-200">Usage metrics</strong> — last active date, number of reports sent, active client count. Used for billing calculations and service improvement.</li>
            </ul>
            <p className="mt-3 text-gray-400">
              We do not collect location data, contacts, or any data beyond what you explicitly provide.
              Access tokens are stored in memory only and never written to localStorage or cookies.
              Refresh tokens are stored as httpOnly cookies — inaccessible to JavaScript.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">2. How we use your data</h2>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400">
              <li>To provide and operate the service — session logging, progress tracking, report generation.</li>
              <li>To send transactional emails — email verification, monthly training reports you request.</li>
              <li>To calculate billing usage — active client count for Trainer subscription tiers.</li>
              <li>To maintain security — device tracking, token rotation, rate limiting.</li>
            </ul>
            <p className="mt-3 text-gray-400">
              We do not sell your data. We do not use your training data for advertising. We do not share
              your data with third parties beyond the infrastructure processors listed below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">3. Third-party processors</h2>
            <p className="mb-4 text-gray-400">
              Your data is processed by the following sub-processors. Each is bound by their own
              data processing agreements and privacy policies.
            </p>

            <div className="space-y-5">
              <div className="border border-surface-border rounded-lg p-4">
                <p className="text-white font-medium mb-1">Railway</p>
                <p className="text-xs text-gray-500 mb-2">Database and backend API hosting</p>
                <p className="text-gray-400">All personal data, training records, and account information are stored in a
                PostgreSQL database hosted on Railway. Railway is SOC 2 Type II certified and
                operates data centres in the United States. Your data does not leave Railway's
                infrastructure except as described in this policy.</p>
              </div>

              <div className="border border-surface-border rounded-lg p-4">
                <p className="text-white font-medium mb-1">Cloudinary</p>
                <p className="text-xs text-gray-500 mb-2">Media storage</p>
                <p className="text-gray-400">Exercise images and videos, and any progress photos you upload, are stored
                on Cloudinary's content delivery network. Only the media URL is stored in our
                database — the file itself lives on Cloudinary. Cloudinary is GDPR compliant
                and operates globally distributed infrastructure.</p>
              </div>

              <div className="border border-surface-border rounded-lg p-4">
                <p className="text-white font-medium mb-1">Resend</p>
                <p className="text-xs text-gray-500 mb-2">Transactional email</p>
                <p className="text-gray-400">We use Resend to deliver verification emails and training reports. When
                we send you an email, your email address and the content of that email are
                processed by Resend. Resend is SOC 2 Type II certified and GDPR compliant.</p>
              </div>

              <div className="border border-surface-border rounded-lg p-4">
                <p className="text-white font-medium mb-1">Vercel</p>
                <p className="text-xs text-gray-500 mb-2">Frontend hosting</p>
                <p className="text-gray-400">The app's frontend (the interface you interact with) is hosted on Vercel.
                Vercel serves static files only — no personal data is stored by Vercel.
                Standard server logs (IP address, request path, timestamp) may be retained
                by Vercel per their own privacy policy.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">4. How we protect your data</h2>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400">
              <li>Passwords hashed with argon2id — never stored or transmitted in plaintext.</li>
              <li>All data in transit encrypted via HTTPS/TLS.</li>
              <li>Refresh tokens stored as httpOnly, Secure cookies — not accessible to JavaScript.</li>
              <li>Access tokens stored in memory only — cleared on logout or page close.</li>
              <li>Rate limiting on all authentication endpoints.</li>
              <li>Device tracking on refresh token rotation — concurrent token use is detected.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">5. Data retention</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — define retention periods before launch. E.g.: account data retained
              for the lifetime of the account plus 30 days after deletion; training data deleted
              on account deletion; media deleted from Cloudinary within X days of account deletion.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">6. Your rights</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — add rights applicable to your jurisdiction before launch. E.g. for GDPR:
              right to access, rectification, erasure, portability, restriction, objection.
              For CCPA: right to know, delete, opt-out of sale. Include how to exercise these rights
              and the contact for data requests.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">7. Cookies</h2>
            <p className="text-gray-400">
              We use one cookie: a httpOnly refresh token cookie used solely to maintain your
              authenticated session. It is not used for tracking or advertising. It is not
              accessible to JavaScript. No third-party analytics or advertising cookies are
              currently in use.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">8. Contact</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — add contact email or form for privacy requests before launch.
              If operating under GDPR, include DPO contact if applicable.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">9. Governing law</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — specify jurisdiction before launch.]
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
