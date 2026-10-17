import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/** Prevents a single render error from blanking the whole signed-in app (common on mobile Safari). */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] render error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page panel" role="alert" style={{ margin: "1rem", padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>{this.props.label ?? "Something went wrong"}</h2>
          <p className="muted" style={{ wordBreak: "break-word" }}>
            {this.state.error.message.slice(0, 280)}
          </p>
          <button
            type="button"
            className="scan-btn"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign("/scanner");
            }}
          >
            Reload scanner
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
