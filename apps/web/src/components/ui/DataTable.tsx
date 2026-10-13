import type { ReactNode } from "react";

export function DataTable(props: {
  headers: string[];
  empty?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="table-wrap wulu-table-wrap">
      <table className="wulu-data-table">
        <thead>
          <tr>
            {props.headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
      {props.footer}
    </div>
  );
}

export function EmptyTableRow(props: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={props.cols} className="muted">
        {props.message}
      </td>
    </tr>
  );
}
