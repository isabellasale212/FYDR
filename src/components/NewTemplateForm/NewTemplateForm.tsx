'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createTemplate, emptyStructure } from '@/lib/queries/weekTemplates';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';

type Props = { orgId: string; userId: string };

export function NewTemplateForm({ orgId, userId }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createTemplate(createClient(), orgId, userId, { name, structure: emptyStructure() }),
      );
      if (result.error || !result.id) throw new HumanError(result.error ?? 'Could not create the template.');
      return result.id;
    },
    onSuccess: (id) => router.push(`/schedule/planner/${id}`),
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the template a name.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ maxWidth: 480 }}>
      <label className="tiny">
        Name
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard 1-game week" autoFocus />
      </label>
      {error ? (
        <p className="tiny" style={{ color: 'var(--bad-text)', marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" style={{ marginTop: 14 }} disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating…' : 'Create and open the builder'}
      </button>
      <p className="cap" style={{ marginTop: 10 }}>
        Starts at MD-6 to MD, empty except MD-1. Add sessions, positions and required entries in
        the builder — nothing here is final.
      </p>
    </form>
  );
}
