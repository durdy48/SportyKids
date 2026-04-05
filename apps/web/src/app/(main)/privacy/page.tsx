'use client';

import { useSearchParams } from 'next/navigation';
import { t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { LegalReviewBanner } from '@/components/LegalReviewBanner';

const LAST_UPDATED: Record<string, string> = { es: 'Marzo 2026', en: 'March 2026' };

/* ── Reusable typography components for legal content ── */

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

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)] mb-2 uppercase tracking-wide opacity-70">{label}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-[var(--color-text)] opacity-85 mb-4">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
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

function PrivacyContent() {
  const searchParams = useSearchParams();
  const localeParam = searchParams.get('locale');
  const locale: Locale = localeParam === 'en' ? 'en' : 'es';
  const otherLocale: Locale = locale === 'es' ? 'en' : 'es';

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur-sm border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[var(--color-blue)] hover:underline text-sm font-medium">
              &larr; {t('legal.back', locale)}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/terms?locale=${locale}`}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {t('legal.terms_of_service', locale)}
            </Link>
            <span className="text-[var(--color-border)]">|</span>
            <Link
              href={`/privacy?locale=${otherLocale}`}
              className="px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-border)] hover:bg-[var(--color-background)] text-[var(--color-text)] transition-colors"
            >
              {otherLocale.toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-2xl">&#9917;</span>
            <span className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-[var(--color-muted)] uppercase tracking-widest">SportyKids</span>
          </div>
          <h1 className="font-[family-name:var(--font-poppins)] text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3 tracking-tight">
            {t('legal.privacy_policy', locale)}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t('legal.last_updated', locale, { date: LAST_UPDATED[locale] })}
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-[var(--color-blue)]/30 via-[var(--color-border)] to-transparent mb-10" />

        {/* Content */}
        {locale === 'en' ? <PrivacyEN /> : <PrivacyES />}

        {/* Footer */}
        <div className="h-px bg-[var(--color-border)] my-10" />
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--color-muted)] pb-8">
          <div className="flex gap-4">
            <span className="font-medium text-[var(--color-text)]">{t('legal.privacy_policy', locale)}</span>
            <Link href={`/terms?locale=${locale}`} className="hover:underline hover:text-[var(--color-text)] transition-colors">
              {t('legal.terms_of_service', locale)}
            </Link>
          </div>
          <span>&copy; 2026 SportyKids</span>
        </footer>
      </main>
    </div>
  );
}

function PrivacyEN() {
  return (
    <div>
      <Section number="01" title="Introduction">
        <P>
          SportyKids (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a personalized sports news application designed for children aged 6-14. We take children&apos;s privacy very seriously. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.
        </P>
        <P>
          This policy complies with the Children&apos;s Online Privacy Protection Act (COPPA), the General Data Protection Regulation (GDPR) including provisions for children&apos;s data (Article 8), and applicable app store policies for children&apos;s applications.
        </P>
      </Section>

      <Section number="02" title="Information We Collect">
        <SubSection label="Information provided during account creation">
          <BulletList items={[
            'Display name (does not need to be a real name)',
            'Age range selection (6-8, 9-11, 12-14)',
            'Favorite sports (selected from a predefined list)',
            'Preferred news sources (selected from a predefined catalog)',
            'Email address (optional, only if parent creates an account with email authentication)',
            'Locale preference (Spanish or English)',
          ]} />
        </SubSection>
        <SubSection label="Information generated through use">
          <BulletList items={[
            'Reading activity (which articles were viewed, duration)',
            'Quiz answers and scores',
            'Sticker and achievement collection progress',
            'Daily streak information',
            'Content reports submitted by the user',
            'Video viewing activity',
          ]} />
        </SubSection>
        <SubSection label="Technical information">
          <BulletList items={[
            'Push notification tokens (if notifications are enabled by parent)',
            'Device type (web browser or mobile platform)',
            'IP address (used only for rate limiting, not stored long-term)',
          ]} />
        </SubSection>
      </Section>

      <Section number="03" title="Information We Do NOT Collect">
        <BulletList items={[
          'Precise geolocation',
          'Photos, videos, or audio from the device',
          'Contacts or address book',
          'Information from other apps',
          'Advertising identifiers',
          'Data for behavioral advertising purposes',
          'Real names (display names are free-form)',
        ]} />
      </Section>

      <Section number="04" title="How We Use Information">
        <P>We use collected information solely to:</P>
        <BulletList items={[
          'Personalize the sports news feed based on favorite sports and teams',
          'Adapt content complexity to the child\u2019s age range',
          'Track quiz progress and gamification features (streaks, stickers, achievements)',
          'Enable parental controls and activity monitoring',
          'Generate weekly activity digests for parents',
          'Send push notifications (streak reminders, daily quiz availability) when enabled by parent',
          'Improve content safety through automated moderation',
        ]} />
        <P>We do NOT use children&apos;s data for:</P>
        <BulletList items={[
          'Advertising of any kind',
          'Profiling for commercial purposes',
          'Sale or sharing with third parties for their marketing purposes',
        ]} />
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Verify that the enumerated uses are exhaustive and accurately reflect all data processing activities in the application.
        </LegalReviewBanner>
      </Section>

      <Section number="05" title="Parental Consent">
        <P>
          For children under 13, we require verifiable parental consent before collecting any personal information. A parent or legal guardian must:
        </P>
        <BulletList items={[
          'Confirm they are the child\u2019s parent or legal guardian',
          'Review this Privacy Policy',
          'Provide affirmative consent',
          'Set up a parental PIN for ongoing access to parental controls',
        ]} />
        <P>Parents can withdraw consent at any time by deleting the child&apos;s account through the Parental Controls panel.</P>
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] COPPA requires &quot;verifiable&quot; parental consent. On-screen confirmation may not meet the FTC&apos;s standard for all cases. Consider whether additional verification methods are needed. The FTC&apos;s COPPA Rule lists acceptable methods in 16 CFR 312.5(b).
        </LegalReviewBanner>
      </Section>

      <Section number="06" title="Parental Rights">
        <P>Parents and legal guardians have the right to:</P>
        <BulletList items={[
          'Review all information collected about their child (via the Parental Controls activity panel)',
          'Delete all of their child\u2019s data (via the "Delete Account" option in Parental Controls)',
          'Withdraw consent and prevent further data collection (by deleting the account)',
          'Restrict content types, daily usage time, and allowed hours',
          'Receive weekly activity digests summarizing their child\u2019s usage',
        ]} />
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] A valid contact method (email, physical address, or phone number) is required by COPPA. Insert actual operator contact information.
        </LegalReviewBanner>
      </Section>

      <Section number="07" title="Data Retention">
        <BulletList items={[
          'User data is retained as long as the account exists',
          'When a parent deletes a child\u2019s account, ALL associated data is permanently and irreversibly deleted within 24 hours',
          'Automated content (aggregated news, videos) is retained independently of user data',
          'Push notification tokens are deleted immediately upon account deletion',
          'Activity logs older than 90 days may be automatically purged',
        ]} />
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Confirm retention periods comply with COPPA&apos;s requirement to retain children&apos;s information only as long as reasonably necessary.
        </LegalReviewBanner>
      </Section>

      <Section number="08" title="Data Security">
        <BulletList items={[
          'Parental PINs are hashed with bcrypt before storage',
          'Passwords are hashed with bcrypt before storage',
          'Authentication uses JWT tokens with short-lived access tokens and rotating refresh tokens',
          'API communication uses HTTPS in production',
          'Rate limiting protects against brute-force attacks on authentication and PIN verification',
          'PIN lockout activates after 5 failed attempts (15-minute cooldown)',
        ]} />
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Enumerate specific security measures and confirm they meet &quot;reasonable security&quot; standards under COPPA and GDPR.
        </LegalReviewBanner>
      </Section>

      <Section number="09" title="Third-Party Services">
        <P><em>When consent is granted</em>, we may use:</P>
        <BulletList items={[
          'PostHog (analytics): Privacy-first analytics platform. No data is sent until parental consent is granted.',
          'Sentry (error tracking): Used to detect and fix application errors. No data is sent until parental consent is granted.',
          'Expo Push Notifications: Used to deliver push notifications when enabled by parent.',
        ]} />
        <P>We do NOT use any advertising networks or ad-tracking services.</P>
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Verify all third-party data processors are listed. Each must have a compliant privacy policy and data processing agreement in place.
        </LegalReviewBanner>
      </Section>

      <Section number="10" title="International Data Transfers">
        <P>
          SportyKids may process data in servers located outside your country of residence. For users in the European Economic Area (EEA), we ensure that any transfer of personal data to countries outside the EEA is subject to appropriate safeguards as required by GDPR.
        </P>
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Specify data processing locations, legal basis for transfers (Standard Contractual Clauses, adequacy decisions, etc.), and ensure compliance with GDPR Chapter V.
        </LegalReviewBanner>
      </Section>

      <Section number="11" title="Children&apos;s Content Safety">
        <P>
          All news content is automatically moderated by AI to filter inappropriate material (gambling, violence, sexual content, etc.). Only approved content is shown to children. Parents can review moderation decisions and report content through the app.
        </P>
      </Section>

      <Section number="12" title="Changes to This Policy">
        <P>We will notify parents of material changes to this Privacy Policy through:</P>
        <BulletList items={[
          'In-app notification',
          'Update to the "Last updated" date at the top of this policy',
        ]} />
        <P>Continued use of the app after notification constitutes acceptance of the updated policy.</P>
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] Under COPPA, material changes to data practices for children under 13 require new parental consent. Implement a mechanism to re-request consent if the policy changes materially.
        </LegalReviewBanner>
      </Section>

      <Section number="13" title="Contact Us">
        <LegalReviewBanner>
          [LEGAL REVIEW REQUIRED] A valid contact method (email, physical address, or phone number) is required by COPPA. Insert actual operator contact information.
        </LegalReviewBanner>
        <P>For questions about this Privacy Policy or to exercise your rights, contact us at:</P>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-[15px] text-[var(--color-text)]">
          <strong>SportyKids</strong><br />
          Email: [INSERT EMAIL]<br />
          Address: [INSERT ADDRESS]
        </div>
      </Section>
    </div>
  );
}

function PrivacyES() {
  return (
    <div>
      <Section number="01" title="Introducci&oacute;n">
        <P>
          SportyKids (&quot;nosotros&quot;, &quot;nos&quot;, &quot;nuestro&quot;) es una aplicaci&oacute;n de noticias deportivas personalizada dise&ntilde;ada para ni&ntilde;os de 6 a 14 a&ntilde;os. Nos tomamos muy en serio la privacidad de los ni&ntilde;os. Esta Pol&iacute;tica de Privacidad explica qu&eacute; informaci&oacute;n recopilamos, c&oacute;mo la usamos y sus derechos respecto a dicha informaci&oacute;n.
        </P>
        <P>
          Esta pol&iacute;tica cumple con la Ley de Protecci&oacute;n de la Privacidad Infantil en L&iacute;nea (COPPA), el Reglamento General de Protecci&oacute;n de Datos (RGPD) incluyendo las disposiciones para datos de menores (Art&iacute;culo 8), y las pol&iacute;ticas aplicables de las tiendas de aplicaciones para aplicaciones infantiles.
        </P>
      </Section>

      <Section number="02" title="Informaci&oacute;n que Recopilamos">
        <SubSection label="Informaci&oacute;n proporcionada durante la creaci&oacute;n de cuenta">
          <BulletList items={[
            'Nombre para mostrar (no necesita ser un nombre real)',
            'Selecci\u00f3n de rango de edad (6-8, 9-11, 12-14)',
            'Deportes favoritos (seleccionados de una lista predefinida)',
            'Fuentes de noticias preferidas (seleccionadas de un cat\u00e1logo predefinido)',
            'Direcci\u00f3n de email (opcional, solo si el padre crea una cuenta con autenticaci\u00f3n por email)',
            'Preferencia de idioma (espa\u00f1ol o ingl\u00e9s)',
          ]} />
        </SubSection>
        <SubSection label="Informaci&oacute;n generada durante el uso">
          <BulletList items={[
            'Actividad de lectura (qu\u00e9 art\u00edculos fueron vistos, duraci\u00f3n)',
            'Respuestas y puntuaciones de quiz',
            'Progreso en colecci\u00f3n de stickers y logros',
            'Informaci\u00f3n de rachas diarias',
            'Reportes de contenido enviados por el usuario',
            'Actividad de visualizaci\u00f3n de videos',
          ]} />
        </SubSection>
        <SubSection label="Informaci&oacute;n t&eacute;cnica">
          <BulletList items={[
            'Tokens de notificaciones push (si las notificaciones est\u00e1n habilitadas por el padre)',
            'Tipo de dispositivo (navegador web o plataforma m\u00f3vil)',
            'Direcci\u00f3n IP (usada solo para limitaci\u00f3n de peticiones, no almacenada a largo plazo)',
          ]} />
        </SubSection>
      </Section>

      <Section number="03" title="Informaci&oacute;n que NO Recopilamos">
        <BulletList items={[
          'Geolocalizaci\u00f3n precisa',
          'Fotos, videos o audio del dispositivo',
          'Contactos o libreta de direcciones',
          'Informaci\u00f3n de otras aplicaciones',
          'Identificadores publicitarios',
          'Datos para publicidad comportamental',
          'Nombres reales (los nombres para mostrar son de formato libre)',
        ]} />
      </Section>

      <Section number="04" title="C&oacute;mo Usamos la Informaci&oacute;n">
        <P>Usamos la informaci&oacute;n recopilada &uacute;nicamente para:</P>
        <BulletList items={[
          'Personalizar el feed de noticias deportivas seg\u00fan deportes y equipos favoritos',
          'Adaptar la complejidad del contenido al rango de edad del ni\u00f1o',
          'Seguimiento de progreso en quiz y funciones de gamificaci\u00f3n (rachas, stickers, logros)',
          'Habilitar controles parentales y monitoreo de actividad',
          'Generar res\u00famenes semanales de actividad para los padres',
          'Enviar notificaciones push (recordatorios de racha, disponibilidad de quiz diario) cuando est\u00e9n habilitadas por el padre',
          'Mejorar la seguridad del contenido mediante moderaci\u00f3n automatizada',
        ]} />
        <P>NO usamos los datos de los ni&ntilde;os para:</P>
        <BulletList items={[
          'Publicidad de ning\u00fan tipo',
          'Perfilado con fines comerciales',
          'Venta o intercambio con terceros para sus fines de marketing',
        ]} />
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Verificar que los usos enumerados son exhaustivos y reflejan con precisi&oacute;n todas las actividades de procesamiento de datos en la aplicaci&oacute;n.
        </LegalReviewBanner>
      </Section>

      <Section number="05" title="Consentimiento Parental">
        <P>
          Para ni&ntilde;os menores de 13 a&ntilde;os, requerimos consentimiento parental verificable antes de recopilar cualquier informaci&oacute;n personal. Un padre o tutor legal debe:
        </P>
        <BulletList items={[
          'Confirmar que es el padre o tutor legal del ni\u00f1o',
          'Revisar esta Pol\u00edtica de Privacidad',
          'Proporcionar consentimiento afirmativo',
          'Configurar un PIN parental para acceso continuo a los controles parentales',
        ]} />
        <P>Los padres pueden retirar el consentimiento en cualquier momento eliminando la cuenta del ni&ntilde;o a trav&eacute;s del panel de Control Parental.</P>
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] COPPA requiere consentimiento parental &quot;verificable&quot;. La confirmaci&oacute;n en pantalla puede no cumplir con el est&aacute;ndar de la FTC en todos los casos. Considerar si se necesitan m&eacute;todos de verificaci&oacute;n adicionales.
        </LegalReviewBanner>
      </Section>

      <Section number="06" title="Derechos Parentales">
        <P>Los padres y tutores legales tienen derecho a:</P>
        <BulletList items={[
          'Revisar toda la informaci\u00f3n recopilada sobre su hijo (a trav\u00e9s del panel de actividad del Control Parental)',
          'Eliminar todos los datos de su hijo (a trav\u00e9s de la opci\u00f3n "Eliminar Cuenta" en el Control Parental)',
          'Retirar el consentimiento y prevenir la recolecci\u00f3n adicional de datos (eliminando la cuenta)',
          'Restringir tipos de contenido, tiempo de uso diario y horas permitidas',
          'Recibir res\u00famenes semanales de actividad sobre el uso de su hijo',
        ]} />
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Se requiere un m&eacute;todo de contacto v&aacute;lido (email, direcci&oacute;n f&iacute;sica o n&uacute;mero de tel&eacute;fono) seg&uacute;n COPPA. Insertar informaci&oacute;n de contacto real del operador.
        </LegalReviewBanner>
      </Section>

      <Section number="07" title="Retenci&oacute;n de Datos">
        <BulletList items={[
          'Los datos del usuario se conservan mientras la cuenta exista',
          'Cuando un padre elimina la cuenta de su hijo, TODOS los datos asociados se eliminan de forma permanente e irreversible en 24 horas',
          'El contenido automatizado (noticias agregadas, videos) se conserva independientemente de los datos del usuario',
          'Los tokens de notificaciones push se eliminan inmediatamente al eliminar la cuenta',
          'Los registros de actividad con m\u00e1s de 90 d\u00edas pueden purgarse autom\u00e1ticamente',
        ]} />
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Confirmar que los per&iacute;odos de retenci&oacute;n cumplen con el requisito de COPPA de conservar la informaci&oacute;n de menores solo mientras sea razonablemente necesario.
        </LegalReviewBanner>
      </Section>

      <Section number="08" title="Seguridad de Datos">
        <BulletList items={[
          'Los PINs parentales se cifran con bcrypt antes de almacenarse',
          'Las contrase\u00f1as se cifran con bcrypt antes de almacenarse',
          'La autenticaci\u00f3n usa tokens JWT con tokens de acceso de corta duraci\u00f3n y tokens de refresco rotativos',
          'La comunicaci\u00f3n API usa HTTPS en producci\u00f3n',
          'La limitaci\u00f3n de peticiones protege contra ataques de fuerza bruta en autenticaci\u00f3n y verificaci\u00f3n de PIN',
          'El bloqueo de PIN se activa tras 5 intentos fallidos (enfriamiento de 15 minutos)',
        ]} />
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Enumerar medidas de seguridad espec&iacute;ficas y confirmar que cumplen con los est&aacute;ndares de &quot;seguridad razonable&quot; bajo COPPA y RGPD.
        </LegalReviewBanner>
      </Section>

      <Section number="09" title="Servicios de Terceros">
        <P><em>Cuando se otorga consentimiento</em>, podemos usar:</P>
        <BulletList items={[
          'PostHog (anal\u00edtica): Plataforma de anal\u00edtica enfocada en privacidad. No se env\u00edan datos hasta que se otorga consentimiento parental.',
          'Sentry (seguimiento de errores): Usado para detectar y corregir errores de la aplicaci\u00f3n. No se env\u00edan datos hasta que se otorga consentimiento parental.',
          'Expo Push Notifications: Usado para entregar notificaciones push cuando est\u00e1n habilitadas por el padre.',
        ]} />
        <P>NO usamos ninguna red publicitaria ni servicio de seguimiento de anuncios.</P>
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Verificar que todos los procesadores de datos de terceros est&eacute;n listados. Cada uno debe tener una pol&iacute;tica de privacidad compatible y un acuerdo de procesamiento de datos vigente.
        </LegalReviewBanner>
      </Section>

      <Section number="10" title="Transferencias Internacionales de Datos">
        <P>
          SportyKids puede procesar datos en servidores ubicados fuera de su pa&iacute;s de residencia. Para usuarios en el Espacio Econ&oacute;mico Europeo (EEE), aseguramos que cualquier transferencia de datos personales a pa&iacute;ses fuera del EEE est&eacute; sujeta a las garant&iacute;as apropiadas requeridas por el RGPD.
        </P>
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Especificar ubicaciones de procesamiento de datos, base legal para transferencias (Cl&aacute;usulas Contractuales Est&aacute;ndar, decisiones de adecuaci&oacute;n, etc.) y asegurar cumplimiento con el Cap&iacute;tulo V del RGPD.
        </LegalReviewBanner>
      </Section>

      <Section number="11" title="Seguridad del Contenido Infantil">
        <P>
          Todo el contenido de noticias es moderado autom&aacute;ticamente por IA para filtrar material inapropiado (apuestas, violencia, contenido sexual, etc.). Solo el contenido aprobado se muestra a los ni&ntilde;os. Los padres pueden revisar las decisiones de moderaci&oacute;n y reportar contenido a trav&eacute;s de la aplicaci&oacute;n.
        </P>
      </Section>

      <Section number="12" title="Cambios a Esta Pol&iacute;tica">
        <P>Notificaremos a los padres de cambios materiales a esta Pol&iacute;tica de Privacidad a trav&eacute;s de:</P>
        <BulletList items={[
          'Notificaci\u00f3n dentro de la aplicaci\u00f3n',
          'Actualizaci\u00f3n de la fecha de "\u00daltima actualizaci\u00f3n" en la parte superior de esta pol\u00edtica',
        ]} />
        <P>El uso continuado de la aplicaci&oacute;n despu&eacute;s de la notificaci&oacute;n constituye la aceptaci&oacute;n de la pol&iacute;tica actualizada.</P>
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Seg&uacute;n COPPA, los cambios materiales en las pr&aacute;cticas de datos para menores de 13 a&ntilde;os requieren un nuevo consentimiento parental. Implementar un mecanismo para volver a solicitar consentimiento si la pol&iacute;tica cambia materialmente.
        </LegalReviewBanner>
      </Section>

      <Section number="13" title="Cont&aacute;ctenos">
        <LegalReviewBanner>
          [REVISI&Oacute;N LEGAL REQUERIDA] Se requiere un m&eacute;todo de contacto v&aacute;lido (email, direcci&oacute;n f&iacute;sica o n&uacute;mero de tel&eacute;fono) seg&uacute;n COPPA. Insertar informaci&oacute;n de contacto real del operador.
        </LegalReviewBanner>
        <P>Para preguntas sobre esta Pol&iacute;tica de Privacidad o para ejercer sus derechos, cont&aacute;ctenos en:</P>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 text-[15px] text-[var(--color-text)]">
          <strong>SportyKids</strong><br />
          Email: [INSERTAR EMAIL]<br />
          Direcci&oacute;n: [INSERTAR DIRECCI&Oacute;N]
        </div>
      </Section>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-border)] border-t-[var(--color-blue)] rounded-full animate-spin" />
      </div>
    }>
      <PrivacyContent />
    </Suspense>
  );
}
