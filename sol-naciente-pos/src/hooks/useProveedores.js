import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado y operaciones CRUD de proveedores.
export function useProveedores() {
  const [proveedores, setProveedores] = useState([]);

  const cargarProveedores = useCallback(async () => {
    setProveedores(await db.listProveedores());
  }, []);

  const guardarProveedor = useCallback(async (p) => {
    await db.saveProveedor(p);
    await cargarProveedores();
  }, [cargarProveedores]);

  const eliminarProveedor = useCallback(async (id) => {
    await db.deleteProveedor(id);
    await cargarProveedores();
  }, [cargarProveedores]);

  return { proveedores, cargarProveedores, guardarProveedor, eliminarProveedor };
}
