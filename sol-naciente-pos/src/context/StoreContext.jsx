import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as db from "../lib/db";
import { useAuth } from "./AuthContext";
import { useProductos } from "../hooks/useProductos";
import { useIngredientes } from "../hooks/useIngredientes";
import { useVentas } from "../hooks/useVentas";
import { useCaja } from "../hooks/useCaja";
import { useProveedores } from "../hooks/useProveedores";
import { useCompras } from "../hooks/useCompras";
import { useClientes } from "../hooks/useClientes";
import { useNomina } from "../hooks/useNomina";
import { useReservas } from "../hooks/useReservas";

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

// Orquesta la carga inicial y compone los hooks de cada dominio
// (productos, ingredientes, ventas, caja, proveedores, compras). La lógica
// de cada uno vive en src/hooks/; este contexto solo expone una API única
// a las páginas.
export function StoreProvider({ children }) {
  const { usuario } = useAuth();
  const { productos, cargarProductos, guardarProducto: guardarProductoBase, eliminarProducto } = useProductos();
  const { ingredientes, cargarIngredientes, guardarIngrediente: guardarIngredienteBase, eliminarIngrediente, ajustarStock: ajustarStockBase } = useIngredientes();
  const { ventas, cargarVentas, historialVentas, cargarHistorial, anularVenta } = useVentas();
  const { cajaActual, movimientosCaja, cajasAbiertas, cargarCaja, abrirCaja, registrarMovimientoCaja, cerrarCaja } = useCaja();
  const { proveedores, cargarProveedores, guardarProveedor, eliminarProveedor } = useProveedores();
  const { compras, cargarCompras } = useCompras();
  const { clientes, cargarClientes, guardarCliente, eliminarCliente } = useClientes();
  const {
    reservas, recursosReserva, cargarReservas, cargarRecursosReserva,
    guardarReserva, guardarRecursoReserva, eliminarRecursoReserva,
    cambiarEstadoReserva, facturarReserva, registrarPagoReserva,
  } = useReservas();
  const {
    empleados, cargarEmpleados, guardarEmpleado, eliminarEmpleado,
    periodos, cargarPeriodos, crearPeriodo, cambiarEstadoPeriodo,
    liquidaciones, cargarLiquidaciones, guardarLiquidacion,
  } = useNomina();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [configuracionNegocio, setConfiguracionNegocio] = useState(null);
  const [puntoVentaId, setPuntoVentaIdState] = useState(() => localStorage.getItem("sol:puntoVentaId") || "");

  const puntoVentaAsignadoId = usuario?.rol === "cajero" ? usuario?.puntoVentaId : null;
  const puntosVentaActivos = puntosVenta.filter((p) => p.activo !== false);
  const puntoVentaActual = puntosVentaActivos.find((p) => p.id === (puntoVentaAsignadoId || puntoVentaId)) || puntosVentaActivos[0] || puntosVenta[0] || null;

  const setPuntoVentaId = useCallback((id) => {
    if (usuario?.rol === "cajero" && usuario?.puntoVentaId) return;
    setPuntoVentaIdState(id);
    if (id) localStorage.setItem("sol:puntoVentaId", id);
  }, [usuario?.rol, usuario?.puntoVentaId]);

  const recargar = useCallback(async () => {
    try {
      const [puntosRes, bodegasRes, categoriasRes, configRes] = await Promise.allSettled([
        db.listPuntosVenta({ incluirInactivos: true }),
        db.listBodegas(),
        db.listCategorias({ incluirInactivas: true }),
        db.getConfiguracionNegocio(),
      ]);
      if (puntosRes.status === "rejected") throw puntosRes.reason;
      const puntos = puntosRes.value;
      const bodegasBase = bodegasRes.status === "fulfilled" ? bodegasRes.value : [];
      const categoriasBase = categoriasRes.status === "fulfilled" ? categoriasRes.value : [];
      const configBase = configRes.status === "fulfilled" ? configRes.value : null;
      const puntosPermitidos = puntoVentaAsignadoId ? puntos.filter((p) => p.id === puntoVentaAsignadoId) : puntos;
      setPuntosVenta(puntosPermitidos);
      setBodegas(bodegasBase);
      setCategorias(categoriasBase);
      setConfiguracionNegocio(configBase);
      const puntosOperativos = puntosPermitidos.filter((p) => p.activo !== false);
      const puntoActivo = puntosOperativos.find((p) => p.id === (puntoVentaAsignadoId || puntoVentaId))?.id || puntosOperativos[0]?.id || "";
      if (puntoActivo && puntoActivo !== puntoVentaId) setPuntoVentaId(puntoActivo);
      await Promise.all([
        cargarProductos(), cargarIngredientes(), cargarVentas(),
        cargarCaja(puntoActivo), cargarProveedores(), cargarCompras(), cargarClientes(), cargarReservas(), cargarRecursosReserva(),
        cargarEmpleados(), cargarPeriodos(),
      ]);
      const avisos = [];
      if (categoriasRes.status === "rejected") avisos.push("No se pudieron cargar categorias. Revisa las columnas color/activo en Supabase.");
      if (bodegasRes.status === "rejected") avisos.push("No se pudieron cargar bodegas.");
      if (configRes.status === "rejected") avisos.push("No se pudo cargar la configuracion del negocio.");
      setError(avisos.join(" ") || null);
    } catch (e) {
      setError(e.message || "Error cargando datos");
    } finally {
      setCargando(false);
    }
  }, [cargarProductos, cargarIngredientes, cargarVentas, cargarCaja, cargarProveedores, cargarCompras, cargarClientes, cargarReservas, cargarRecursosReserva, cargarEmpleados, cargarPeriodos, puntoVentaId, puntoVentaAsignadoId, setPuntoVentaId]);

  useEffect(() => { recargar(); }, [recargar]);

  useEffect(() => {
    if (puntoVentaActual?.id) cargarCaja(puntoVentaActual.id);
  }, [puntoVentaActual?.id, cargarCaja]);

  const idUsuario = () => (usuario?.id && usuario.id !== "demo" ? usuario.id : undefined);

  // Registrar una factura descuenta inventario y se vincula a la caja abierta: refresca ventas e inventario.
  const facturar = async (payload) => {
    const r = await db.crearFactura({ ...payload, id_punto: puntoVentaActual?.id, id_caja: cajaActual?.id_caja, id_usuario: idUsuario() });
    await Promise.all([cargarVentas(), cargarIngredientes(), cargarProductos()]);
    return r;
  };

  const abrirCajaCtx = async (montoInicial, idUsuarioParam) => {
    await abrirCaja(montoInicial, idUsuarioParam, puntoVentaActual?.id);
  };

  // Anular una venta del historial devuelve el inventario consumido: refresca inventario completo.
  const anularVentaCtx = async (idVenta) => {
    await anularVenta(idVenta, idUsuario());
    await Promise.all([cargarIngredientes(), cargarProductos()]);
  };

  const guardarProductoCtx = async (payload) => {
    await guardarProductoBase(payload, idUsuario());
  };

  const guardarIngredienteCtx = async (payload) => {
    await guardarIngredienteBase(payload, idUsuario());
  };

  const ajustarStockCtx = async (payload) => {
    await ajustarStockBase({ ...payload, idUsuario: idUsuario() });
  };

  // Registrar una compra aumenta stock de insumos o productos directos: refresca inventario completo.
  const registrarCompra = async (payload) => {
    const r = await db.crearCompra({ ...payload, idUsuario: idUsuario() });
    await Promise.all([cargarCompras(), cargarIngredientes(), cargarProductos()]);
    return r;
  };

  const facturarReservaCtx = async (reservaId, pago = "Efectivo") => {
    const r = await facturarReserva({ reservaId, pago, idPunto: puntoVentaActual?.id, idCaja: cajaActual?.id_caja, idUsuario: idUsuario() });
    await Promise.all([cargarVentas(), cargarHistorial()]);
    return r;
  };

  const registrarPagoReservaCtx = async (payload) => {
    await registrarPagoReserva({ ...payload, idUsuario: idUsuario() });
    await cargarHistorial();
  };

  const guardarPuntoVenta = async (payload) => {
    await db.savePuntoVenta(payload);
    const puntos = await db.listPuntosVenta({ incluirInactivos: true });
    setPuntosVenta(puntoVentaAsignadoId ? puntos.filter((p) => p.id === puntoVentaAsignadoId) : puntos);
  };

  const eliminarPuntoVenta = async (id) => {
    await db.deletePuntoVenta(id);
    const puntos = await db.listPuntosVenta({ incluirInactivos: true });
    setPuntosVenta(puntoVentaAsignadoId ? puntos.filter((p) => p.id === puntoVentaAsignadoId) : puntos);
  };

  const guardarConfiguracionNegocio = async (payload) => {
    const config = await db.saveConfiguracionNegocio(payload, idUsuario());
    setConfiguracionNegocio(config);
    return config;
  };

  const guardarCategoria = async (payload) => {
    await db.saveCategoria(payload, idUsuario());
    const cats = await db.listCategorias({ incluirInactivas: true });
    setCategorias(cats);
    await cargarProductos();
  };

  const ordenarCategorias = async (categoriasOrdenadas) => {
    await db.ordenarCategorias(categoriasOrdenadas, idUsuario());
    const cats = await db.listCategorias({ incluirInactivas: true });
    setCategorias(cats);
  };

  const eliminarCategoria = async (payload) => {
    await db.deleteCategoria(payload, idUsuario());
    const cats = await db.listCategorias({ incluirInactivas: true });
    setCategorias(cats);
    await cargarProductos();
  };

  return (
    <StoreCtx.Provider value={{
      productos, ingredientes, ventas, cargando, error, modoDemo: db.modoDemo,
      configuracionNegocio, guardarConfiguracionNegocio,
      categorias, guardarCategoria, ordenarCategorias, eliminarCategoria,
      recargar, puntosVenta, bodegas, puntoVentaId: puntoVentaActual?.id || "", puntoVentaActual, setPuntoVentaId,
      guardarPuntoVenta, eliminarPuntoVenta,
      guardarProducto: guardarProductoCtx, eliminarProducto, guardarIngrediente: guardarIngredienteCtx, eliminarIngrediente, ajustarStock: ajustarStockCtx,
      facturar, siguienteNumero: db.siguienteNumero,
      cajaActual, movimientosCaja, cajasAbiertas, cargarCaja: () => cargarCaja(puntoVentaActual?.id), abrirCaja: abrirCajaCtx, registrarMovimientoCaja, cerrarCaja,
      proveedores, guardarProveedor, eliminarProveedor,
      compras, registrarCompra,
      clientes, guardarCliente, eliminarCliente,
      reservas, recursosReserva, guardarReserva, guardarRecursoReserva, eliminarRecursoReserva, cambiarEstadoReserva, facturarReserva: facturarReservaCtx, registrarPagoReserva: registrarPagoReservaCtx,
      historialVentas, cargarHistorial, anularVenta: anularVentaCtx,
      empleados, guardarEmpleado, eliminarEmpleado,
      periodos, crearPeriodo, cambiarEstadoPeriodo,
      liquidaciones, cargarLiquidaciones, guardarLiquidacion,
    }}>
      {children}
    </StoreCtx.Provider>
  );
}
