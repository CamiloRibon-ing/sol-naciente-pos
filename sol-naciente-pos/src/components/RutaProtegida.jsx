import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Login from "../pages/Login";

// Bloquea el acceso a la app hasta que haya una sesión válida.
export default function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sol-crema">
        <Loader2 className="animate-spin text-sol-azul mb-3" size={34} />
        <p className="text-sol-gris font-bold">Verificando sesión…</p>
      </div>
    );
  }

  if (!usuario) return <Login />;

  return children;
}
