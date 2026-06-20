import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado y operaciones CRUD del catálogo de productos.
export function useProductos() {
  const [productos, setProductos] = useState([]);

  const cargarProductos = useCallback(async () => {
    setProductos(await db.listProductos());
  }, []);

  const guardarProducto = useCallback(async (p, idUsuario) => {
    await db.saveProducto(p, idUsuario);
    await cargarProductos();
  }, [cargarProductos]);

  const eliminarProducto = useCallback(async (id) => {
    await db.deleteProducto(id);
    await cargarProductos();
  }, [cargarProductos]);

  return { productos, cargarProductos, guardarProducto, eliminarProducto };
}
