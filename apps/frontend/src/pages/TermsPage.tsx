// pages/TermsPage.tsx — Terms of Service (Phase 15)
// Public route, no auth required.
// [PLACEHOLDER] sections require legal review before launch.

import { useNavigate } from 'react-router-dom'

export default function TermsPage(): React.JSX.Element {
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
          Terms of Service
        </h1>
        <p className="text-xs text-gray-500 mb-10">Last updated: [DATE — PLACEHOLDER]</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">1. Acceptance</h2>
            <p className="text-gray-400">
              By creating an account and using this service, you agree to these Terms of Service
              and our Privacy Policy. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">2. Description of service</h2>
            <p className="text-gray-400">
              This app is a training log and coaching management tool for athletes and personal
              trainers. It allows you to record training sessions, track progress over time,
              manage client relationships, and generate training reports. The service is provided
              as a progressive web application accessible via any modern browser.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">3. Your account</h2>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must be at least 16 years old to create an account.</li>
              <li>You may not share your account with others or create accounts on behalf of others without their consent.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">4. Acceptable use</h2>
            <p className="mb-3 text-gray-400">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400">
              <li>Use the service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorised access to any part of the service or its infrastructure.</li>
              <li>Upload content that infringes intellectual property rights or contains malware.</li>
              <li>Use the service to store or transmit data about individuals without their knowledge or consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">5. Client data (Trainer accounts)</h2>
            <p className="text-gray-400">
              If you use the service to manage client training data, you are responsible for
              obtaining appropriate consent from those clients to collect and process their
              personal information. You act as a data controller for your clients' data.
              We act as a data processor on your behalf. You must not add client data without
              the client's knowledge and consent.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">6. Subscription and billing</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — complete before SaaS launch. Include: free tier limits, paid tier
              pricing, billing cycle, what happens on non-payment, refund policy, cancellation
              terms, how active client count is calculated for Trainer billing.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">7. Service availability</h2>
            <p className="text-gray-400">
              We aim to keep the service available but do not guarantee uninterrupted access.
              We may perform maintenance, updates, or experience downtime outside our control.
              The service is provided "as is" without warranty of any kind.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">8. Your data</h2>
            <p className="text-gray-400">
              You own the training data you create. We do not claim ownership of your content.
              You grant us a limited licence to store and process your data solely to provide
              the service. See our Privacy Policy for full details on how your data is handled.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">9. Termination</h2>
            <p className="text-gray-400">
              You may delete your account at any time. We may suspend or terminate accounts
              that violate these terms. On termination, your data will be deleted in accordance
              with our Privacy Policy retention schedule.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">10. Limitation of liability</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — add limitation of liability and disclaimer clauses before launch.
              Have these reviewed by a lawyer, especially if operating across multiple jurisdictions.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">11. Changes to these terms</h2>
            <p className="text-gray-400">
              We may update these terms from time to time. We will notify you of material
              changes by email or by a notice in the app. Continued use after the effective
              date of changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">12. Governing law</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — specify jurisdiction before launch.]
            </p>
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-widest text-command-blue mb-3">13. Contact</h2>
            <p className="text-gray-400 italic">
              [PLACEHOLDER — add contact details before launch.]
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
