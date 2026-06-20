import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import { StoreProvider } from "./context/StoreContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import RutaProtegida from "./components/RutaProtegida.jsx";
import "./index.css";

// Sin React.StrictMode: @react-pdf/renderer inicializa su motor de layout
// (Yoga, en WebAssembly) en el efecto de montaje del hook usePDF. StrictMode
// monta los efectos dos veces en desarrollo, lo que crea dos instancias del
// modulo WASM y produce "BindingError: Expected null or instance of Config,
// got an instance of Config" al generar cualquier PDF.
ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          borderRadius: "12px",
          background: "#fff",
          color: "#222A3A",
          border: "1px solid #EFE6D6",
          fontWeight: 600,
          fontSize: "14px",
          boxShadow: "0 8px 24px rgba(20,30,50,0.12)",
        },
        success: { iconTheme: { primary: "#159A5A", secondary: "#fff" } },
        error: { iconTheme: { primary: "#E22B23", secondary: "#fff" } },
      }}
    />
    <RutaProtegida>
      <StoreProvider>
        <App />
      </StoreProvider>
    </RutaProtegida>
  </AuthProvider>
);
