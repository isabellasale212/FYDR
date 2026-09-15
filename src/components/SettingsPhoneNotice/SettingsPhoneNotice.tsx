'use client';

import { usePathname } from 'next/navigation';
import { DesktopOnlyNotice } from '@/components/DesktopOnlyNotice/DesktopOnlyNotice';
import { PHONE_HIDDEN_ROUTES } from '@/lib/settingsHub';

/* The settings routes that are desktop-only at phone width (Isabella, 16 Sept
 * 2026, overnight queue 2.6) draw the desktop-only notice there — one
 * component in the settings layout, deciding by pathname, so the ten pages
 * are not each edited. base.css's `.main:has(> .desk-note)` hides the rest of
 * the column below 768px. Nothing at 768px and above: the notice is
 * data-phone-only. Presentation, not permission. */
export function SettingsPhoneNotice() {
  const pathname = usePathname();
  const hidden = PHONE_HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!hidden) return null;
  return (
    <DesktopOnlyNotice
      title="This setting is desktop-only"
      body="Open Fydr on a desktop or laptop for the club's plan, details, groups, thresholds, people and data. Your own profile and notifications are here on your phone."
      action={{ href: '/settings', label: 'Back to Settings' }}
    />
  );
}
