'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/* TESTING AT PHONE WIDTH IS LOGGING (Isabella, 16 Sept 2026, the evening
 * queue, 2.7): one "Log test" button with a dropdown of the test type, and
 * choosing one opens the sheet that logs results for every player. The
 * sheet is the test's own page (/testing/[id]) — forms stay pages — drawn
 * at phone width as the grid with a name filter and nothing else. Drawn
 * below 768px only (data-phone-only on the wrapper in the page); the
 * definitions list and the add-a-test form are the desktop's. */
type Props = {
  tests: readonly { id: string; name: string }[];
};

export function TestLogPicker({ tests }: Props) {
  const router = useRouter();
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  if (tests.length === 0) {
    return (
      <p className="cap" style={{ margin: 0 }}>
        No tests defined yet.
      </p>
    );
  }
  return (
    <form
      className="test-log-picker"
      onSubmit={(e) => {
        e.preventDefault();
        if (testId) router.push(`/testing/${testId}`);
      }}
    >
      <label className="label" htmlFor="test-log-type">
        Test
      </label>
      <select id="test-log-type" className="field" value={testId} onChange={(e) => setTestId(e.target.value)}>
        {tests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 'var(--sp-12)', minHeight: 'var(--tap-min)' }}>
        Log test
      </button>
    </form>
  );
}
