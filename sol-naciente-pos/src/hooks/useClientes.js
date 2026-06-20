import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado y operaciones CRUD de clientes.
export function useClientes() {
  const [clientes, setClientes] = useState([]);

  const cargarClientes = useCallback(async () => {
    setClientes(await db.listClientes());
  }, []);

  const guardarCliente = useCallback(async (c) => {
    const guardado = await db.saveCliente(c);
    await cargarClientes();
    return guardado;
  }, [cargarClientes]);

  const eliminarCliente = useCallback(async (id) => {
    await db.deleteCliente(id);
    await cargarClientes();
  }, [cargarClientes]);

  return { clientes, cargarClientes, guardarCliente, eliminarCliente };
}
