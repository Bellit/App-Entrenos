import { Component, type ReactNode } from 'react';
import './ErrorBoundary.css';

/**
 * Si algo falla al dibujar, en vez de dejar la página en blanco
 * muestra un aviso con una salida: volver a la biblioteca.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  private startNew = () => {
    location.hash = '#/';
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>No se ha podido mostrar esta pantalla</h1>
        <p>Algo ha fallado al dibujar. Tus ejercicios siguen guardados en este dispositivo: vuelve al inicio para abrirlos.</p>
        <div className="row">
          <button className="btn primary" onClick={this.startNew}>
            Volver al inicio
          </button>
                  </div>
        <p className="muted small">Detalle: {this.state.error.message}</p>
      </div>
    );
  }
}
