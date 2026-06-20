import { useState, useEffect } from "react";

// Devuelve `value` retrasado `delay` ms — útil para buscadores que no deben
// filtrar/consultar en cada pulsación de tecla.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
