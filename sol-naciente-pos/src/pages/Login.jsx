import { useState } from "react";
import { LogIn } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { Brandmark, Boton, campoCN as campo, etiquetaCN as etiqueta } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await login(correo, password);
      toast.success("¡Bienvenido de nuevo!");
    } catch (err) {
      const msg = err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : err.message || "No se pudo iniciar sesión";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sol-crema p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-sol-borde p-6">
        <div className="flex justify-center mb-6"><Brandmark /></div>
        <h1 className="text-center font-extrabold text-lg text-sol-tinta mb-1">Iniciar sesión</h1>
        <p className="text-center text-sol-gris text-[13px] mb-5">Ingresa con tu correo y contraseña.</p>
        <form onSubmit={enviar} className="space-y-3">
          <label>
            <span className={etiqueta}>Correo</span>
            <input
              type="email" required autoFocus className={campo}
              value={correo} onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
            />
          </label>
          <label>
            <span className={etiqueta}>Contraseña</span>
            <input
              type="password" required className={campo}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <Boton type="submit" className="w-full mt-2" disabled={enviando}>
            <LogIn size={16} /> {enviando ? "Ingresando…" : "Ingresar"}
          </Boton>
        </form>
      </div>
    </div>
  );
}
