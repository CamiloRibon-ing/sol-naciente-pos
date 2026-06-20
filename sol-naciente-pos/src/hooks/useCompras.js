import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado e historial de compras a proveedores.
export function useCompras() {
  const [compras, setCompras] = useState([]);

  const cargarCompras = useCallback(async () => {
    setCompras(await db.listCompras());
  }, []);

  return { compras, cargarCompras };
}
