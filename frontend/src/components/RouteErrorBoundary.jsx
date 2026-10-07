import { Component } from 'react';

/** Bắt lỗi render — tránh trắng màn hình toàn app trên mobile */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="ios-page-error flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
          <p className="text-lg font-semibold text-[var(--color-label)]">Không tải được trang</p>
          <p className="text-sm text-[var(--color-label-secondary)] max-w-sm break-words">
            {error.message || 'Lỗi không xác định'}
          </p>
          <button type="button" className="apple-btn-primary mt-2" onClick={this.handleReload}>
            Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
