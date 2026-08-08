'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { updateGroup, GROUP_COLOURS } from '@/lib/queries/groups';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';

type Props = {
  orgId: string;
  groupId: string;
  initialName: string;
  initialDescription: string | null;
  initialColour: string | null;
};

/** The rename/recolour/redescribe form screens/groups.md's role table
 *  promises and GroupEditorForm.tsx's create form never covered — see
 *  updateGroup()'s own comment for exactly what's editable and why type
 *  isn't. Opened inline from a toggle on the group detail page, the same
 *  "reveal in place, no separate route" pattern BodyWeightPanel uses for
 *  the player profile's log-weigh-in form, rather than a full navigation
 *  to an /edit URL for a two-field change. */
export function GroupEditForm({ orgId, groupId, initialName, initialDescription, initialColour }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [colour, setColour] = useState<string | null>(initialColour);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await updateGroup(createClient(), groupId, orgId, {
        name,
        description: description.trim() ? description.trim() : null,
        colour,
      });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (err: Error) => setError(err.message),
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

  // The button lives in the topbar's row of controls, beside Archive and
  // the theme toggle; the form itself is a popover anchored under it
  // rather than a fourth item in that same flex row — a whole edit card
  // doesn't belong wedged between two buttons, and this is a two-field
  // edit, not a page navigation.
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Edit
      </button>
      {open ? (
        <form
          onSubmit={onSubmit}
          className="card"
          noValidate
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 320,
            zIndex: 20,
          }}
        >
          <label className="label" htmlFor="group-edit-name">
            Name
          </label>
          <input
            id="group-edit-name"
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
          />

          <label className="label" htmlFor="group-edit-description" style={{ marginTop: 14 }}>
            Description
          </label>
          <input
            id="group-edit-description"
            className="field"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
            placeholder="Optional"
          />

          <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
            <legend className="label">Colour</legend>
            <div className="chiprow" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="squad-chip"
                aria-pressed={colour === null}
                onClick={() => setColour(null)}
              >
                None
              </button>
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
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setName(initialName);
                setDescription(initialDescription ?? '');
                setColour(initialColour);
                setError(null);
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
