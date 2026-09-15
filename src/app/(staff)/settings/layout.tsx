import { SettingsPhoneNotice } from '@/components/SettingsPhoneNotice/SettingsPhoneNotice';

/* 2.6 (Isabella, 16 Sept 2026): the desktop-only settings routes show the
 * notice at phone width and nothing else — SettingsPhoneNotice decides by
 * pathname (lib/settingsHub.ts's PHONE_HIDDEN_ROUTES), base.css's
 * `.main:has(> .desk-note)` hides the rest below 768px. No wrapper around
 * the pages: the desktop DOM is exactly what it was. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsPhoneNotice />
      {children}
    </>
  );
}
