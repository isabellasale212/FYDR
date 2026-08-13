'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createGroup, GROUP_COLOURS } from '@/lib/queries/groups';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';

const GROUP_TYPES = [
  { value: 'positional', label: 'Positional' },
  { value: 'training', label: 'Training' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'age', label: 'Age' },
  { value: 'custom', label: 'Custom' },
] as const;

type Props = { orgId: string };

/** screens/groups.md's create form: name, type, description, a constrained
 *  colour picker (never a free colour wheel — see GROUP_COLOURS). The
 *  sibling edit form (name, description, colour — no type field, see
 *  updateGroup()'s own comment for why) lives on the group detail page,
 *  GroupEditForm.tsx. */
export function GroupEditorForm({ orgId }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<(typeof GROUP_TYPES)[number]['value']>('custom');
  const [description, setDescription] = useState('');
  const [colour, setColour] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createGroup(createClient(), {
          orgId,
          name,
          description: description.trim() ? description.trim() : null,
          colour,
          groupType,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      router.push('/settings/groups');
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <label className="label" htmlFor="group-name">
        Name
      </label>
      <input
        id="group-name"
        className="field"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        placeholder="Forwards"
      />
      <p className="cap" style={{ marginTop: 4 }}>
        Used in filters across the app.
      </p>

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Type</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {GROUP_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className="squad-chip"
              aria-pressed={groupType === t.value}
              onClick={() => setGroupType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="label" htmlFor="group-description" style={{ marginTop: 14 }}>
        Description
      </label>
      <input
        id="group-description"
        className="field"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={200}
        placeholder="Optional"
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Colour</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {GROUP_COLOURS.map((c) => (
            <button
              key={c.name}
              type="button"
              className="squad-chip"
              aria-pressed={colour === c.name}
              onClick={() => setColour(c.name)}
              style={{ gap: 6 }}
            >
              <GroupSwatch colour={c.name} />
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Creating…' : 'Create group'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => router.push('/settings/groups')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
