import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado y operaciones CRUD de ingredientes (insumos) e inventario.
export function useIngredientes() {
  const [ingredientes, setIngredientes] = useState([]);

  const cargarIngredientes = useCallback(async () => {
    setIngredientes(await db.listIngredientes());
  }, []);

  const guardarIngrediente = useCallback(async (g, idUsuario) => {
    await db.saveIngrediente(g, idUsuario);
    await cargarIngredientes();
  }, [cargarIngredientes]);

  const eliminarIngrediente = useCallback(async (id) => {
    await db.deleteIngrediente(id);
    await cargarIngredientes();
  }, [cargarIngredientes]);

  const ajustarStock = useCallback(async (payload) => {
    await db.ajustarStock(payload);
    await cargarIngredientes();
  }, [cargarIngredientes]);

  return { ingredientes, cargarIngredientes, guardarIngrediente, eliminarIngrediente, ajustarStock };
}
