'use client';

import { useSearchParams } from 'next/navigation';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { LegalReviewBanner } from '@/components/LegalReviewBanner';

const LAST_UPDATED: Record<string, string> = { es: 'Marzo 2026', en: 'March 2026' };

/* ── Reusable typography components ── */

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-[family-name:var(--font-poppins)] text-sm font-bold text-[var(--color-blue)] tabular-nums shrink-0">{number}</span>
        <h2 className="font-[family-name:var(--font-poppins)] text-lg font-bold text-[var(--color-text)]">{title}</h2>
      </div>
      <div className="pl-0 md:pl-9">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-[var(--color-text)] opacity-85 mb-4">{children}</p>;
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--color-text)] opacity-85">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-blue)] opacity-50 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Main layout ── */

function TermsContent() {
  const searchParams = useSearchParams();
  const localeParam = searchParams.get('locale');
  const locale: Locale = localeParam === 'en' ? 'en' : 'es';
  const otherLocale: Locale = locale === 'es' ? 'en' : 'es';

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="sticky top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[var(--color-blue)] hover:underline text-sm font-medium">
              &larr; {t('legal.back', locale)}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/privacy?locale=${locale}`}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {t('legal.privacy_policy', locale)}
            </Link>
            <span className="text-[var(--color-border)]">|</span>
            <Link
              href={`/terms?locale=${otherLocale}`}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-border)] hover:bg-[var(--color-background)] text-[var(--color-text)] transition-colors"
            >
              {otherLocale.toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-2xl">&#9917;</span>
            <span className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--color-muted)] uppercase tracking-widest">SportyKids</span>
          </div>
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3 tracking-tight">
            {t('legal.terms_of_service', locale)}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t('legal.last_updated', locale, { date: LAST_UPDATED[locale] })}
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-[var(--color-blue)]/30 via-[var(--color-border)] to-transparent mb-10" />

        {locale === 'en' ? <TermsEN /> : <TermsES />}

        <div className="h-px bg-[var(--color-border)] my-10" />
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--color-muted)] pb-8">
          <div className="flex gap-4">
            <Link href={`/privacy?locale=${locale}`} className="hover:underline hover:text-[var(--color-text)] transition-colors">
              {t('legal.privacy_policy', locale)}
            </Link>
            <span className="font-medium text-[var(--color-text)]">{t('legal.terms_of_service', locale)}</span>
          </div>
          <span>&copy; 2026 SportyKids</span>
        </footer>
      </main>
    </div>
  );
}

function TermsEN() {
  return (
    <div>
      <Section number="01" title="Acceptance of Terms">
        <P>
          By using SportyKids (&quot;the Service&quot;), you agree to these Terms of Service. If you are under 18, your parent or legal guardian must agree to these terms on your behalf. For children under 13, a parent or legal guardian must provide consent before the child can use the Service.
        </P>
      </Section>

      <Section number="02" title="Description of Service">
        <P>SportyKids is a personalized sports news application that provides:</P>
        <BulletList items={[
          'Curated sports news from verified press sources',
          'Short sports video clips (Reels)',
          'Interactive sports quizzes',
          'Gamification features (stickers, achievements, streaks)',
          'Parental controls and activity monitoring',
        ]} />
        <P>The Service is designed for children aged 6-14 and their parents/guardians.</P>
      </Section>

      <Section number="03" title="User Accounts">
        <BulletList items={[
          'Users may create accounts anonymously, with email/password, or via social login (Google, Apple)',
          'Children under 13 require parental consent to create an account',
          'Users are responsible for maintaining the confidentiality of their account credentials',
          'Parents are responsible for their children\u2019s use of the Service',
        ]} />
      </Section>

      <Section number="04" title="Acceptable Use">
        <P>Users must NOT:</P>
        <BulletList items={[
          'Use the Service for any unlawful purpose',
          'Attempt to access other users\u2019 accounts or data',
          'Submit false content reports',
          'Attempt to circumvent parental controls',
          'Use automated tools to scrape or access the Service',
          'Misrepresent their age during the age verification process',
        ]} />
      </Section>

      <Section number="05" title="Content">
        <BulletList items={[
          'All news content is aggregated from third-party RSS sources and remains the property of the original publishers',
          'SportyKids does not claim ownership of aggregated content',
          'Content is automatically moderated for child safety but we cannot guarantee all content will be appropriate',
          'Users can report inappropriate content through the in-app reporting feature',
        ]} />
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Review content aggregation practices against RSS source terms of service. Ensure fair use / linking practices are legally sound.
        </LegalReviewBanner>
      </Section>

      <Section number="06" title="Intellectual Property">
        <BulletList items={[
          'The SportyKids application, its design, features, and original content are protected by intellectual property laws',
          'Users are granted a limited, non-exclusive, non-transferable license to use the Service for personal, non-commercial purposes',
          'The sticker and achievement artwork is owned by SportyKids',
        ]} />
      </Section>

      <Section number="07" title="Privacy">
        <P>
          Our collection and use of personal information is governed by our{' '}
          <Link href="/privacy?locale=en" className="text-[var(--color-blue)] hover:underline font-medium">Privacy Policy</Link>.
          The Privacy Policy is incorporated into these Terms by reference.
        </P>
      </Section>

      <Section number="08" title="Disclaimers">
        <BulletList items={[
          'The Service is provided "as is" without warranties of any kind',
          'We do not guarantee the accuracy, completeness, or timeliness of aggregated news content',
          'We are not responsible for content published by third-party news sources',
          'Quiz questions are for entertainment and educational purposes; accuracy is not guaranteed',
        ]} />
      </Section>

      <Section number="09" title="Limitation of Liability">
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Draft appropriate limitation of liability clause compliant with applicable consumer protection laws, particularly those applicable to services directed at children.
        </LegalReviewBanner>
        <P>
          To the maximum extent permitted by applicable law, SportyKids shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
        </P>
      </Section>

      <Section number="10" title="Account Termination">
        <BulletList items={[
          'Parents can delete their child\u2019s account at any time through Parental Controls',
          'We may suspend or terminate accounts that violate these Terms',
          'Upon account deletion, all associated personal data is permanently deleted',
        ]} />
      </Section>

      <Section number="11" title="Changes to Terms">
        <P>We may update these Terms from time to time. We will notify users of material changes through in-app notifications. Continued use after notification constitutes acceptance.</P>
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] For children under 13, material changes may require renewed parental consent under COPPA.
        </LegalReviewBanner>
      </Section>

      <Section number="12" title="Governing Law">
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Specify governing law jurisdiction. Consider that the app targets users in multiple countries (ES, GB, US, FR, IT, DE). EU consumer protection laws may limit choice-of-law provisions for EU users.
        </LegalReviewBanner>
      </Section>

      <Section number="13" title="Contact">
        <P>For questions about these Terms, contact us at:</P>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-[15px] text-[var(--color-text)]">
          <strong>SportyKids</strong><br />
          Email: [INSERT EMAIL]<br />
          Address: [INSERT ADDRESS]
        </div>
      </Section>
    </div>
  );
}

function TermsES() {
  return (
    <div>
      <Section number="01" title="Aceptaci&oacute;n de los T&eacute;rminos">
        <P>
          Al usar SportyKids (&quot;el Servicio&quot;), usted acepta estos T&eacute;rminos de Servicio. Si es menor de 18 a&ntilde;os, su padre o tutor legal debe aceptar estos t&eacute;rminos en su nombre. Para ni&ntilde;os menores de 13 a&ntilde;os, un padre o tutor legal debe proporcionar consentimiento antes de que el ni&ntilde;o pueda usar el Servicio.
        </P>
      </Section>

      <Section number="02" title="Descripci&oacute;n del Servicio">
        <P>SportyKids es una aplicaci&oacute;n de noticias deportivas personalizada que ofrece:</P>
        <BulletList items={[
          'Noticias deportivas curadas de fuentes de prensa verificadas',
          'Clips cortos de video deportivo (Reels)',
          'Quizzes deportivos interactivos',
          'Funciones de gamificaci\u00f3n (stickers, logros, rachas)',
          'Controles parentales y monitoreo de actividad',
        ]} />
        <P>El Servicio est&aacute; dise&ntilde;ado para ni&ntilde;os de 6 a 14 a&ntilde;os y sus padres/tutores.</P>
      </Section>

      <Section number="03" title="Cuentas de Usuario">
        <BulletList items={[
          'Los usuarios pueden crear cuentas de forma an\u00f3nima, con email/contrase\u00f1a, o mediante inicio de sesi\u00f3n social (Google, Apple)',
          'Los ni\u00f1os menores de 13 a\u00f1os requieren consentimiento parental para crear una cuenta',
          'Los usuarios son responsables de mantener la confidencialidad de sus credenciales de cuenta',
          'Los padres son responsables del uso del Servicio por parte de sus hijos',
        ]} />
      </Section>

      <Section number="04" title="Uso Aceptable">
        <P>Los usuarios NO deben:</P>
        <BulletList items={[
          'Usar el Servicio para cualquier prop\u00f3sito ilegal',
          'Intentar acceder a las cuentas o datos de otros usuarios',
          'Enviar reportes de contenido falsos',
          'Intentar eludir los controles parentales',
          'Usar herramientas automatizadas para extraer datos o acceder al Servicio',
          'Falsificar su edad durante el proceso de verificaci\u00f3n de edad',
        ]} />
      </Section>

      <Section number="05" title="Contenido">
        <BulletList items={[
          'Todo el contenido de noticias se agrega de fuentes RSS de terceros y permanece como propiedad de los editores originales',
          'SportyKids no reclama la propiedad del contenido agregado',
          'El contenido se modera autom\u00e1ticamente para la seguridad infantil pero no podemos garantizar que todo el contenido sea apropiado',
          'Los usuarios pueden reportar contenido inapropiado a trav\u00e9s de la funci\u00f3n de reportes de la aplicaci\u00f3n',
        ]} />
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Revisar las pr&aacute;cticas de agregaci&oacute;n de contenido contra los t&eacute;rminos de servicio de las fuentes RSS.
        </LegalReviewBanner>
      </Section>

      <Section number="06" title="Propiedad Intelectual">
        <BulletList items={[
          'La aplicaci\u00f3n SportyKids, su dise\u00f1o, caracter\u00edsticas y contenido original est\u00e1n protegidos por leyes de propiedad intelectual',
          'A los usuarios se les otorga una licencia limitada, no exclusiva e intransferible para usar el Servicio con fines personales y no comerciales',
          'Las ilustraciones de stickers y logros son propiedad de SportyKids',
        ]} />
      </Section>

      <Section number="07" title="Privacidad">
        <P>
          Nuestra recolecci&oacute;n y uso de informaci&oacute;n personal se rige por nuestra{' '}
          <Link href="/privacy?locale=es" className="text-[var(--color-blue)] hover:underline font-medium">Pol&iacute;tica de Privacidad</Link>.
          La Pol&iacute;tica de Privacidad se incorpora a estos T&eacute;rminos por referencia.
        </P>
      </Section>

      <Section number="08" title="Descargo de Responsabilidad">
        <BulletList items={[
          'El Servicio se proporciona "tal cual" sin garant\u00edas de ning\u00fan tipo',
          'No garantizamos la exactitud, integridad o actualidad del contenido de noticias agregado',
          'No somos responsables del contenido publicado por fuentes de noticias de terceros',
          'Las preguntas del quiz son con fines de entretenimiento y educativos; no se garantiza su precisi\u00f3n',
        ]} />
      </Section>

      <Section number="09" title="Limitaci&oacute;n de Responsabilidad">
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Redactar una cl&aacute;usula de limitaci&oacute;n de responsabilidad apropiada conforme a las leyes de protecci&oacute;n al consumidor aplicables.
        </LegalReviewBanner>
        <P>
          En la m&aacute;xima medida permitida por la ley aplicable, SportyKids no ser&aacute; responsable de ning&uacute;n da&ntilde;o indirecto, incidental, especial, consecuente o punitivo que surja del uso del Servicio.
        </P>
      </Section>

      <Section number="10" title="Terminaci&oacute;n de Cuenta">
        <BulletList items={[
          'Los padres pueden eliminar la cuenta de su hijo en cualquier momento a trav\u00e9s del Control Parental',
          'Podemos suspender o terminar cuentas que violen estos T\u00e9rminos',
          'Al eliminar una cuenta, todos los datos personales asociados se eliminan permanentemente',
        ]} />
      </Section>

      <Section number="11" title="Cambios a los T&eacute;rminos">
        <P>Podemos actualizar estos T&eacute;rminos de vez en cuando. Notificaremos a los usuarios de cambios materiales a trav&eacute;s de notificaciones dentro de la aplicaci&oacute;n. El uso continuado despu&eacute;s de la notificaci&oacute;n constituye aceptaci&oacute;n.</P>
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Para ni&ntilde;os menores de 13 a&ntilde;os, los cambios materiales pueden requerir un nuevo consentimiento parental seg&uacute;n COPPA.
        </LegalReviewBanner>
      </Section>

      <Section number="12" title="Ley Aplicable">
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Especificar la jurisdicci&oacute;n de la ley aplicable.
        </LegalReviewBanner>
      </Section>

      <Section number="13" title="Contacto">
        <P>Para preguntas sobre estos T&eacute;rminos, cont&aacute;ctenos en:</P>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-[15px] text-[var(--color-text)]">
          <strong>SportyKids</strong><br />
          Email: [INSERTAR EMAIL]<br />
          Direcci&oacute;n: [INSERTAR DIRECCI&Oacute;N]
        </div>
      </Section>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-border)] border-t-[var(--color-blue)] rounded-full animate-spin" />
      </div>
    }>
      <TermsContent />
    </Suspense>
  );
}
