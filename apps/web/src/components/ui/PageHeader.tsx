import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header wulu-page-header">
      <div>
        <h1 className="page-title">{props.title}</h1>
        {props.subtitle ? <p className="page-sub">{props.subtitle}</p> : null}
      </div>
      {props.actions ? <div className="wulu-page-actions">{props.actions}</div> : null}
    </header>
  );
}
