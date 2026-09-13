/* A read-only panel keeps its content and names its owner — STAFF-SS-02-05
 * C5 (decided 2026-09-12). The well closes the panel: an uppercase line
 * saying whose the panel is ("Read-only · set by medical staff") and one
 * sentence naming the person and the date, so a reader who cannot change
 * something knows who can and how current it is. No control is rendered at
 * 45% opacity: disabled is for a control you could have used, not for one
 * that was never yours — the panel simply has no control. The same well
 * treatment the schedule's read-only names use (.sg-readonly-well): --surf2
 * in --border, --muted text.
 */
type Props = {
  /** Who owns the panel, in role words: "medical staff", "the nutritionist". */
  owner: string;
  /** The person who last set it, if known. */
  name: string | null;
  /** The formatted date of the last change, if known. */
  date: string | null;
  /** An optional second sentence — what a reader may still do here. */
  note?: string;
};

export function ReadOnlyOwner({ owner, name, date, note }: Props) {
  const who = name ? (date ? `${name} · ${date}` : name) : date ? `Last set ${date}` : null;
  return (
    <div className="ro-owner">
      <p className="ro-owner-k">Read-only · set by {owner}</p>
      {who ? <p className="ro-owner-v">{who}</p> : null}
      {note ? <p className="ro-owner-v">{note}</p> : null}
    </div>
  );
}
