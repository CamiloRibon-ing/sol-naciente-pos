import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // Evita que Vite pre-empaquete @react-pdf/renderer en mas de una instancia:
  // si el motor de layout Yoga (WASM) se inicializa dos veces, sus clases
  // internas dejan de ser compatibles entre si y lanza un BindingError.
  optimizeDeps: { include: ["@react-pdf/renderer"] },
});
