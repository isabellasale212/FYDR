const VAR_BY_NAME: Record<string, string> = {
  Blue: 'var(--group-blue)',
  Green: 'var(--group-green)',
  Purple: 'var(--group-purple)',
  Slate: 'var(--group-slate)',
  Indigo: 'var(--group-indigo)',
  Cyan: 'var(--group-cyan)',
  Olive: 'var(--group-olive)',
  Magenta: 'var(--group-magenta)',
  Steel: 'var(--group-steel)',
  Plum: 'var(--group-plum)',
};

type Props = { colour: string | null; size?: number };

/** A group's colour, resolved from the name stored in groups.colour to the
 * light/dark token pair in tokens.css — never a raw hex in a component,
 * CONTRACT.md's CSS rule. Colour alone is never the identifier: every place
 * this renders sits beside the group's name (06-design-system.md §4.1). */
export function GroupSwatch({ colour, size = 10 }: Props) {
  const background = colour ? (VAR_BY_NAME[colour] ?? 'var(--faint)') : 'var(--faint)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        flex: 'none',
        display: 'inline-block',
      }}
    />
  );
}
