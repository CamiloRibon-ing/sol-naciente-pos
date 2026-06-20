import { useState, useCallback } from "react";
import * as cajaDb from "../lib/caja";

// Estado y operaciones de la caja del punto de venta (apertura, movimientos, cierre).
export function useCaja() {
  const [cajaActual, setCajaActual] = useState(null);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [cajasAbiertas, setCajasAbiertas] = useState([]);

  const cargarCaja = useCallback(async (idPunto) => {
    const caja = await cajaDb.getCajaAbierta(idPunto);
    setCajaActual(caja);
    setMovimientosCaja(caja ? await cajaDb.listMovimientos(caja.id_caja) : []);
    setCajasAbiertas(await cajaDb.listCajasAbiertas());
  }, []);

  const abrirCaja = useCallback(async (montoInicial, idUsuario, idPunto) => {
    if (cajaActual) throw new Error("Ya hay una caja abierta");
    await cajaDb.abrirCaja({ montoInicial, idUsuario, idPunto });
    await cargarCaja(idPunto);
  }, [cajaActual, cargarCaja]);

  const registrarMovimientoCaja = useCallback(async (tipo, descripcion, monto, idUsuario) => {
    if (!cajaActual) throw new Error("No hay una caja abierta");
    await cajaDb.registrarMovimiento({ idCaja: cajaActual.id_caja, tipo, descripcion, monto, idUsuario });
    await cargarCaja();
  }, [cajaActual, cargarCaja]);

  const cerrarCaja = useCallback(async (montoFinalEsperado, montoFinalReal, idUsuario) => {
    if (!cajaActual) throw new Error("No hay una caja abierta para cerrar");
    const cerrada = await cajaDb.cerrarCaja({ idCaja: cajaActual.id_caja, montoFinalEsperado, montoFinalReal, idUsuario });
    await cargarCaja();
    return cerrada;
  }, [cajaActual, cargarCaja]);

  return { cajaActual, movimientosCaja, cajasAbiertas, cargarCaja, abrirCaja, registrarMovimientoCaja, cerrarCaja };
}
