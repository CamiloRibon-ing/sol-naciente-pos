import { useCallback, useState } from "react";
import * as db from "../lib/db";

export function useReservas() {
  const [reservas, setReservas] = useState([]);
  const [recursosReserva, setRecursosReserva] = useState([]);

  const cargarReservas = useCallback(async () => {
    setReservas(await db.listReservas());
  }, []);

  const cargarRecursosReserva = useCallback(async () => {
    setRecursosReserva(await db.listRecursosReserva());
  }, []);

  const guardarReserva = useCallback(async (payload) => {
    await db.saveReserva(payload);
    await cargarReservas();
  }, [cargarReservas]);

  const guardarRecursoReserva = useCallback(async (payload) => {
    await db.saveRecursoReserva(payload);
    await cargarRecursosReserva();
  }, [cargarRecursosReserva]);

  const eliminarRecursoReserva = useCallback(async (payload) => {
    await db.deleteRecursoReserva(payload);
    await cargarRecursosReserva();
  }, [cargarRecursosReserva]);

  const cambiarEstadoReserva = useCallback(async (id, estado) => {
    await db.cambiarEstadoReserva(id, estado);
    await cargarReservas();
  }, [cargarReservas]);

  const facturarReserva = useCallback(async (payload) => {
    const r = await db.facturarReserva(payload);
    await cargarReservas();
    return r;
  }, [cargarReservas]);

  const registrarPagoReserva = useCallback(async (payload) => {
    await db.registrarPagoReserva(payload);
    await cargarReservas();
  }, [cargarReservas]);

  return {
    reservas,
    recursosReserva,
    cargarReservas,
    cargarRecursosReserva,
    guardarReserva,
    guardarRecursoReserva,
    eliminarRecursoReserva,
    cambiarEstadoReserva,
    facturarReserva,
    registrarPagoReserva,
  };
}
