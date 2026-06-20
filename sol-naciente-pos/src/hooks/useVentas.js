import { useState, useCallback } from "react";
import * as db from "../lib/db";

// Estado e historial de ventas (facturas).
export function useVentas() {
  const [ventas, setVentas] = useState([]);
  const [historialVentas, setHistorialVentas] = useState([]);

  const cargarVentas = useCallback(async () => {
    setVentas(await db.listVentas());
  }, []);

  const cargarHistorial = useCallback(async () => {
    setHistorialVentas(await db.listVentasHistorial());
  }, []);

  const anularVenta = useCallback(async (idVenta, idUsuario) => {
    await db.anularVenta(idVenta, idUsuario);
    await Promise.all([cargarVentas(), cargarHistorial()]);
  }, [cargarVentas, cargarHistorial]);

  return { ventas, cargarVentas, historialVentas, cargarHistorial, anularVenta };
}
