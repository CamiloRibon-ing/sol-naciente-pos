import { useState, useCallback } from "react";
import * as nomina from "../lib/nomina";

// Estado y operaciones de nómina: empleados, períodos y liquidaciones.
export function useNomina() {
  const [empleados, setEmpleados] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);

  const cargarEmpleados = useCallback(async () => {
    setEmpleados(await nomina.listEmpleados());
  }, []);

  const guardarEmpleado = useCallback(async (e) => {
    await nomina.saveEmpleado(e);
    await cargarEmpleados();
  }, [cargarEmpleados]);

  const eliminarEmpleado = useCallback(async (id) => {
    await nomina.deleteEmpleado(id);
    await cargarEmpleados();
  }, [cargarEmpleados]);

  const cargarPeriodos = useCallback(async () => {
    setPeriodos(await nomina.listPeriodos());
  }, []);

  const crearPeriodo = useCallback(async (p) => {
    const nuevo = await nomina.crearPeriodo(p);
    await cargarPeriodos();
    return nuevo;
  }, [cargarPeriodos]);

  const cambiarEstadoPeriodo = useCallback(async (id, estado) => {
    await nomina.cambiarEstadoPeriodo(id, estado);
    await cargarPeriodos();
  }, [cargarPeriodos]);

  const cargarLiquidaciones = useCallback(async (idPeriodo) => {
    setLiquidaciones(await nomina.listNominaDetalle(idPeriodo));
  }, []);

  const guardarLiquidacion = useCallback(async (idPeriodo, idEmpleado, datos) => {
    await nomina.guardarLiquidacion(idPeriodo, idEmpleado, datos);
    await cargarLiquidaciones(idPeriodo);
  }, [cargarLiquidaciones]);

  return {
    empleados, cargarEmpleados, guardarEmpleado, eliminarEmpleado,
    periodos, cargarPeriodos, crearPeriodo, cambiarEstadoPeriodo,
    liquidaciones, cargarLiquidaciones, guardarLiquidacion,
  };
}
