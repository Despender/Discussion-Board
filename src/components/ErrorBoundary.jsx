import { Component } from 'react';
import Button from 'react-bootstrap/Button';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="lobby-page lobby-page--error text-center text-light p-4">
        <p className="mb-2">Помилка відображення сторінки</p>
        <p className="small text-muted mb-3">{error?.message || String(error)}</p>
        <Button variant="primary" onClick={() => window.location.assign('/')}>
          На головну
        </Button>
      </div>
    );
  }
}
