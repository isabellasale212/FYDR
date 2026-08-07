type Props = {
  title: string;
  body: string;
  headingLevel?: 2 | 3;
};

/** A named absence. An empty panel with no explanation reads as a broken panel,
 *  and 06-design-system.md §11.3 requires each panel to fail on its own. */
export function EmptyState({ title, body, headingLevel = 2 }: Props) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      <p>{body}</p>
    </div>
  );
}
