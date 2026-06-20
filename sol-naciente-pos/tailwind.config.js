/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        sol: {
          azul: "#1A4FA0",
          azulOsc: "#143C7A",
          rojo: "#E22B23",
          rojoOsc: "#B71F18",
          amarillo: "#FBB814",
          naranja: "#F58220",
          crema: "#FFF8EE",
          suave: "#FBF3E4",
          tinta: "#222A3A",
          gris: "#6B7280",
          grisClaro: "#9AA1AD",
          borde: "#EFE6D6",
          exito: "#159A5A",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
