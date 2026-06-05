import type { Metadata } from 'next';
import { LegalDocumentLayout } from '@/app/components/landing/LegalDocumentLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — admirror',
  description: 'How admirror collects, uses, and protects your information.',
};

const LAST_UPDATED = 'May 22, 2026';
const CONTACT_EMAIL = 'diegolinaresd10@gmail.com';

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        admirror (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the admirror web application at{' '}
        <a href="https://www.admirror.app">admirror.app</a>. This Privacy Policy explains how we
        collect, use, and share information when you use our service.
      </p>

      <h2>1. Information we collect</h2>
      <p>We may collect the following types of information:</p>
      <ul>
        <li>
          <strong>Account information</strong> — When you sign in with Google, we receive your email
          address and basic profile details provided by the authentication provider.
        </li>
        <li>
          <strong>Content you provide</strong> — Reference ads, product images, product URLs, copy,
          guidelines, and other materials you upload or enter to generate creatives.
        </li>
        <li>
          <strong>Generated output</strong> — Prompts and images created through the service, stored in
          your account history for a limited time (see Retention below).
        </li>
        <li>
          <strong>Usage and device data</strong> — Log data such as IP address (hashed where applicable
          for free-trial abuse prevention), browser type, pages visited, and actions taken in the app.
        </li>
        <li>
          <strong>Payment information</strong> — Subscriptions are processed by Whop. We do not store
          full payment card details; we receive subscription status and related identifiers from Whop.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide, operate, and improve admirror</li>
        <li>Generate ad prompts and images based on your inputs</li>
        <li>Manage subscriptions and credits</li>
        <li>Communicate with you about the service, billing, or support requests</li>
        <li>Detect abuse, enforce our Terms, and protect the security of our platform</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. AI and third-party services</h2>
      <p>
        To deliver the service, we send relevant inputs (such as images, text, and URLs) to third-party
        providers, including but not limited to:
      </p>
      <ul>
        <li>Google Gemini — prompt generation and image analysis</li>
        <li>Kie.ai — image generation</li>
        <li>Firecrawl — product page scraping when you provide a URL</li>
        <li>Supabase — authentication, database, and file storage</li>
        <li>Whop — subscription billing</li>
        <li>ImgBB and similar hosts — temporary hosting of uploaded images</li>
      </ul>
      <p>
        These providers process data according to their own privacy policies. We only share what is
        reasonably necessary to perform the requested feature.
      </p>

      <h2>4. Cookies and local storage</h2>
      <p>
        We use cookies and browser storage for authentication sessions, preferences, and checkout flow
        state. You can control cookies through your browser settings, but disabling them may limit
        functionality.
      </p>

      <h2>5. Data retention</h2>
      <p>
        Generated images in your History are retained for approximately <strong>30 days</strong>, after
        which they may be deleted from our systems. Account and subscription records are kept as long as
        needed to provide the service and meet legal requirements. You may request deletion of your
        account by contacting us.
      </p>

      <h2>6. Your choices and rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete personal data we hold about you</li>
        <li>Object to or restrict certain processing</li>
        <li>Withdraw consent where processing is consent-based</li>
        <li>Lodge a complaint with a supervisory authority</li>
      </ul>
      <p>
        To exercise these rights, email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may need to verify your identity
        before responding.
      </p>

      <h2>7. Security</h2>
      <p>
        We implement reasonable technical and organizational measures to protect your information.
        No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2>8. Children</h2>
      <p>
        admirror is not intended for users under 16. We do not knowingly collect personal information
        from children. If you believe a child has provided us data, contact us and we will delete it.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Your information may be processed in countries other than your own, including where our service
        providers operate. We take steps to ensure appropriate safeguards where required by law.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the revised version on this
        page and update the &quot;Last updated&quot; date. Continued use of admirror after changes
        constitutes acceptance of the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about this Privacy Policy? Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalDocumentLayout>
  );
}
