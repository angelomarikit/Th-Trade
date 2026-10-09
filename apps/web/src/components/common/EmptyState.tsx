export function EmptyState(props: {
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <div className="panel empty-state">
      {props.badge && <span className="badge amber" style={{ marginBottom: "0.75rem" }}>{props.badge}</span>}
      <strong>{props.title}</strong>
      <p>{props.body}</p>
    </div>
  );
}
