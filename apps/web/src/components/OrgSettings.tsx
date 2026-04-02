'use client';

import { useEffect, useRef, useState } from 'react';
import { t, COLORS } from '@sportykids/shared';
import type { Organization } from '@sportykids/shared';

interface Props {
  org: Organization;
  onSave: (data: Partial<{ name: string; logoUrl: string | null; customColors: { primary: string; secondary: string } | null; maxMembers: number; active: boolean }>) => void;
  onRegenerateCode: () => void;
  onClose: () => void;
  locale: string;
  colors: Record<string, string>;
}

export function OrgSettings({ org, onSave, onRegenerateCode, onClose, locale, colors }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(org.name);
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(org.customColors?.primary ?? COLORS.blue);
  const [secondaryColor, setSecondaryColor] = useState(org.customColors?.secondary ?? COLORS.green);
  const [maxMembers, setMaxMembers] = useState(org.maxMembers);
  const [active, setActive] = useState(org.active);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const handleSave = () => {
    onSave({
      name,
      logoUrl: logoUrl || null,
      customColors: { primary: primaryColor, secondary: secondaryColor },
      maxMembers,
      active,
    });
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={t('org.settings_title', locale)}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 p-6 rounded-2xl"
        style={{ backgroundColor: colors.surface }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
            {t('org.settings_title', locale)}
          </h2>
          <button
            onClick={onClose}
            className="text-xl"
            aria-label={t('a11y.common.close', locale)}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
              {t('org.settings_name', locale)}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
              {t('org.settings_logo', locale)}
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
              placeholder="https://..."
            />
          </div>

          {/* Colors */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                {t('org.settings_primary_color', locale)}
              </label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
                {t('org.settings_secondary_color', locale)}
              </label>
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Max Members */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text }}>
              {t('org.settings_max_members', locale)}
            </label>
            <input
              type="number"
              value={maxMembers}
              onChange={(e) => setMaxMembers(parseInt(e.target.value) || 100)}
              min={5}
              max={500}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: colors.text }}>
              {t('org.settings_active', locale)}
            </span>
            <button
              onClick={() => setActive(!active)}
              role="switch"
              aria-checked={active}
              className="w-12 h-6 rounded-full relative transition-colors"
              style={{ backgroundColor: active ? colors.blue : colors.border }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ left: active ? 24 : 2 }}
              />
            </button>
          </div>

          {/* Invite code */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
            <div>
              <p className="text-xs" style={{ color: colors.muted }}>{t('org.settings_invite_code', locale)}</p>
              <p className="font-mono font-bold tracking-wider" style={{ color: colors.text }}>{org.inviteCode}</p>
            </div>
            <button
              onClick={onRegenerateCode}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: colors.border, color: colors.text }}
              aria-label={t('a11y.org.regenerate_code', locale)}
            >
              {t('org.settings_regenerate', locale)}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ color: colors.text }}
          >
            {t('delete_account.confirm_cancel', locale)}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm text-white"
            style={{ backgroundColor: colors.blue }}
          >
            {t('org.settings_save', locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
