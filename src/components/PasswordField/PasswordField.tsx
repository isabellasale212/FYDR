'use client';

import { useState } from 'react';

/**
 * A password input with a show/hide eye button (audit S9 — the app had no
 * way to see what you typed anywhere). Used on sign-in and on the reset
 * confirmation page; ChangePasswordForm in settings is unchanged for now.
 *
 * The button keeps a fixed accessible name and exposes its state through
 * aria-pressed, per the WAI toggle-button pattern — a label that flipped to
 * "Hide password" *and* aria-pressed would announce the state twice. The
 * icon swap is decorative. The overlay is a 44px square on the trailing
 * edge of the 44px field row (.pw-toggle in base.css).
 */
export function PasswordField(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  name?: string;
  required?: boolean;
}) {
  const { id, value, onChange, autoComplete, name, required } = props;
  const [visible, setVisible] = useState(false);

  return (
    <div className="pw-wrap">
      <input
        id={id}
        className="field"
        type={visible ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        required={required}
        spellCheck={false}
        autoCapitalize="none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label="Show password"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <svg
            aria-hidden="true"
            focusable="false"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3.2" />
            <path d="M4 3.5l16 17" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            focusable="false"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        )}
      </button>
    </div>
  );
}
