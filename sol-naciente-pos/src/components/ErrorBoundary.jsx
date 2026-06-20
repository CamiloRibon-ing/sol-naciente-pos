import { Component } from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary capturo un error:", error, info);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, () => this.setState({ error: null }));
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangle className="text-sol-rojo" size={28} />
          <p className="font-bold text-sol-tinta">No se pudo mostrar este contenido.</p>
          <p className="text-xs text-sol-gris max-w-sm">{this.state.error?.message || "Ocurrio un error inesperado."}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 rounded-xl px-4 py-2 text-sm font-bold bg-sol-azul text-white hover:bg-sol-azulOsc"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
