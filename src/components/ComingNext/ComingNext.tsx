type Props = {
  eyebrow: string;
  title: string;
  /** What this row will hold, in the client's words rather than a placeholder. */
  body: string;
};

/** A sidebar row that exists so the shell is complete, and says plainly that it
 *  is not built yet. An empty screen with no explanation reads as a fault. */
export function ComingNext({ eyebrow, title, body }: Props) {
  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="empty">
        <h2>Coming in the next phase</h2>
        <p>{body}</p>
      </div>
    </>
  );
}
