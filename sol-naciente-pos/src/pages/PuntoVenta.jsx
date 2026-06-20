import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { IMPUESTO, METODOS_PAGO } from "../lib/format";
import { disponibleProducto, ingredienteFaltante } from "../lib/stock";
import { ConfirmDialog } from "../components/ui";
import ProductCard from "../components/ProductCard";
import CartPanel from "../components/CartPanel";
import DocumentoPreview from "../components/pdf/DocumentoPreview";
import ClienteForm from "../components/ClienteForm";

export default function PuntoVenta() {
  const { productos, ingredientes, clientes, categorias, facturar, siguienteNumero, puntoVentaActual, configuracionNegocio, guardarCliente } = useStore();
  const [cart, setCart] = useState([]);
  const [cat, setCat] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [cliente, setCliente] = useState("");
  const [idCliente, setIdCliente] = useState(null);
  const [pago, setPago] = useState("Efectivo");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagos, setPagos] = useState([{ metodo: "Efectivo", monto: 0 }, { metodo: "Tarjeta", monto: 0 }]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [doc, setDoc] = useState(null);
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [paginaMenu, setPaginaMenu] = useState(1);
  const productosPorPagina = 12;

  const seleccionarCliente = (id) => {
    setIdCliente(id || null);
    const c = clientes.find((x) => x.id === id);
    setCliente(c ? c.nombre : "");
  };

  const guardarClienteRapido = async (payload) => {
    try {
      const guardado = await guardarCliente(payload);
      const clienteCreado = guardado?.id ? guardado : clientes.find((c) => c.correo === payload.correo && c.nombre === payload.nombre);
      if (clienteCreado?.id) {
        setIdCliente(clienteCreado.id);
        setCliente(clienteCreado.nombre);
      } else {
        setCliente(payload.nombre);
      }
      setNuevoCliente(false);
      toast.success("Cliente registrado y seleccionado");
    } catch (e) {
      toast.error(e.message || "No se pudo registrar el cliente");
    }
  };

  const dispDe = (p) => disponibleProducto(p, ingredientes, cart, productos);

  const avisarStockBajo = (p, restante) => {
    if (restante !== Infinity && restante < 3) {
      toast(restante <= 0 ? `${p.nombre}: sin stock disponible` : `${p.nombre}: quedan ${restante} disponibles`, { icon: "⚠️", duration: 2500 });
    }
  };

  const agregar = (p) => {
    const disp = dispDe(p);
    if (disp <= 0) {
      const falta = ingredienteFaltante(p, ingredientes, cart, productos);
      toast.error(`Sin stock suficiente${falta ? ` de ${falta}` : ""}`);
      return;
    }
    setCart((c) => {
      const ex = c.find((x) => x.id === p.id);
      return ex ? c.map((x) => (x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x))
        : [...c, { id: p.id, nombre: p.nombre, cat: p.cat, precio: p.precio, costo: p.costo, cantidad: 1, descuento: 0, nota: "" }];
    });
    toast.success(`${p.nombre} agregado`, { duration: 1200 });
    avisarStockBajo(p, disp - 1);
  };

  const inc = (id) => {
    const p = productos.find((x) => x.id === id);
    const disp = dispDe(p);
    if (disp <= 0) {
      const falta = ingredienteFaltante(p, ingredientes, cart, productos);
      toast.error(`No hay más stock${falta ? ` de ${falta}` : ""}`);
      return;
    }
    setCart((c) => c.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + 1 } : x)));
    avisarStockBajo(p, disp - 1);
  };
  const dec = (id) => setCart((c) => c.map((x) => (x.id === id ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x)));
  const quitar = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const actualizarItem = (id, patch) => setCart((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const impuestoRate = Number(configuracionNegocio?.impuestoRate ?? IMPUESTO) || 0;

  const limpiarPedido = () => {
    setCart([]);
    setCliente("");
    setIdCliente(null);
    setDescuentoGlobal(0);
    setPagoMixto(false);
    setConfirmarLimpiar(false);
  };

  // Totales con descuentos por ítem y descuento global aplicados en cascada.
  const totales = useMemo(() => {
    const subtotalBruto = cart.reduce((s, l) => s + l.precio * l.cantidad, 0);
    const descuentoItems = cart.reduce((s, l) => s + Math.round(l.precio * l.cantidad * (Number(l.descuento) || 0) / 100), 0);
    const subtotalNeto = subtotalBruto - descuentoItems;
    const descuentoGlobalMonto = Math.round(subtotalNeto * (Number(descuentoGlobal) || 0) / 100);
    const baseImponible = subtotalNeto - descuentoGlobalMonto;
    const descuentoTotal = descuentoItems + descuentoGlobalMonto;
    const impuestos = Math.round(baseImponible * impuestoRate);
    const total = baseImponible + impuestos;
    return { subtotalBruto, descuentoTotal, baseImponible, impuestos, total };
  }, [cart, descuentoGlobal, impuestoRate]);

  const construirDoc = (tipo, numero, fecha = new Date(), pagosDoc = null, ventaId = null) => {
    const clienteInfo = clientes.find((c) => c.id === idCliente);
    const tasaImpuestoDoc = Number(configuracionNegocio?.impuestoRate ?? IMPUESTO) || 0;
    const pagosFinales = pagosDoc || (pagoMixto ? pagos.filter((p) => Number(p.monto) > 0).map((p) => ({ metodo: p.metodo, monto: Number(p.monto) || 0 })) : [{ metodo: pago, monto: totales.total }]);
    return {
      tipo, numero, fecha,
      idVenta: ventaId,
      cliente: cliente || clienteInfo?.nombre || "",
      pago: pagosFinales.map((p) => p.metodo).join(" + ") || pago,
      pagos: pagosFinales,
      impuestoRate: tasaImpuestoDoc,
      clienteDocumento: clienteInfo?.documento || "",
      clienteTelefono: clienteInfo?.telefono || "",
      clienteCorreo: clienteInfo?.correo || "",
      puntoVenta: puntoVentaActual?.nombre || "",
      descuentoGlobal,
      estadoElectronico: tipo === "FACTURA" ? "Pendiente de integracion DIAN" : "No aplica",
      lineas: cart.map((l) => ({ productoId: l.id, nombre: l.nombre, cat: l.cat, cantidad: l.cantidad, precio: l.precio, costo: l.costo, descuento: l.descuento, nota: l.nota })),
    };
  };

  const cotizar = () => {
    if (!cart.length) return;
    setDoc(construirDoc("COTIZACION", siguienteNumero("COTIZACION")));
  };

  const normalizarPagosMixtos = (pagosBase, total) => {
    const positivos = pagosBase
      .filter((p) => Number(p.monto) > 0)
      .map((p) => ({ metodo: p.metodo, monto: Number(p.monto) || 0 }));
    const suma = positivos.reduce((s, p) => s + p.monto, 0);
    if (!positivos.length || suma < total) {
      return { ok: false, error: "La suma de los pagos debe cubrir el total" };
    }
    if (suma === total) return { ok: true, pagos: positivos };

    const exceso = suma - total;
    const idxEfectivo = positivos.findIndex((p) => String(p.metodo).toLowerCase() === "efectivo");
    if (idxEfectivo < 0 || positivos[idxEfectivo].monto < exceso) {
      return { ok: false, error: "Solo el efectivo puede superar el total para calcular cambio" };
    }
    const ajustados = positivos.map((p, i) => (i === idxEfectivo ? { ...p, monto: p.monto - exceso } : p)).filter((p) => p.monto > 0);
    return { ok: true, pagos: ajustados, cambio: exceso };
  };

  const generarFactura = async () => {
    if (!cart.length) return;
    const numero = siguienteNumero("FACTURA");
    const lineas = cart.map((l) => ({ productoId: l.id, nombre: l.nombre, cantidad: l.cantidad, precio: l.precio, costo: l.costo, descuento: Number(l.descuento) || 0, nota: l.nota || "" }));
    const { baseImponible, descuentoTotal, impuestos, total } = totales;

    let pagosFinal = [{ metodo: pago, monto: total }];
    if (pagoMixto) {
      const normalizados = normalizarPagosMixtos(pagos, total);
      if (!normalizados.ok) {
        toast.error(normalizados.error);
        return;
      }
      pagosFinal = normalizados.pagos;
    }

    const t = toast.loading("Generando factura…");
    try {
      const r = await facturar({ numero, cliente, pago, pagos: pagosFinal, lineas, subtotal: baseImponible, descuento: descuentoTotal, impuestos, total, id_cliente: idCliente });
      setDoc(construirDoc("FACTURA", r.numero || numero, r.fecha || new Date(), pagosFinal, r.id));
      toast.success("Venta registrada e inventario actualizado", { id: t });
      setCart([]); setCliente(""); setIdCliente(null); setDescuentoGlobal(0); setPagoMixto(false);
    } catch (e) {
      toast.error(e.message || "No se pudo registrar la venta", { id: t });
    }
  };

  const filtrados = useMemo(
    () => productos.filter((p) =>
      p.activo &&
      (cat === "todas" || p.cat === cat) &&
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.desc || "").toLowerCase().includes(busqueda.toLowerCase()))
    ),
    [productos, cat, busqueda]
  );

  useEffect(() => {
    setPaginaMenu(1);
  }, [cat, busqueda]);

  const totalPaginasMenu = Math.max(1, Math.ceil(filtrados.length / productosPorPagina));
  const paginaActualMenu = Math.min(paginaMenu, totalPaginasMenu);
  const desdeProducto = (paginaActualMenu - 1) * productosPorPagina;
  const productosPagina = filtrados.slice(desdeProducto, desdeProducto + productosPorPagina);
  const hastaProducto = Math.min(filtrados.length, desdeProducto + productosPorPagina);
  const cambiarPaginaMenu = (nuevaPagina) => setPaginaMenu(Math.max(1, Math.min(totalPaginasMenu, nuevaPagina)));
  const inicioPaginas = Math.max(1, Math.min(paginaActualMenu - 3, totalPaginasMenu - 6));
  const paginasVisibles = Array.from(
    { length: Math.min(totalPaginasMenu, 7) },
    (_, i) => inicioPaginas + i
  );

  return (
    <div className="flex-1 flex flex-col xl:flex-row min-h-0">
      <section className="flex-1 p-4 md:p-6 min-h-0 overflow-hidden flex flex-col">
        <h1 className="font-extrabold text-2xl">Menú</h1>
        <p className="text-sol-gris text-[13px] mb-4">Arma el pedido del cliente y genera la factura o cotización.</p>

        <div className="relative mb-4 max-w-md">
          <Search size={17} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…"
            className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
          {[{ id: "todas", nombre: "Todo" }, ...categorias.filter((c) => c.activo !== false)].map((c) => {
            const act = cat === c.id;
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition border ${act ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde hover:border-sol-azul"}`}>
                {c.nombre}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 rounded-2xl border border-sol-borde bg-white/60 p-3 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <div>
              <h2 className="font-extrabold text-sm text-sol-tinta">Productos disponibles</h2>
              <p className="text-xs text-sol-gris">
                {filtrados.length ? `Mostrando ${desdeProducto + 1}-${hastaProducto} de ${filtrados.length}` : "Sin productos para mostrar"}
              </p>
            </div>
            {filtrados.length > productosPorPagina && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => cambiarPaginaMenu(paginaActualMenu - 1)} disabled={paginaActualMenu <= 1}
                  className="h-9 w-9 rounded-xl border border-sol-borde bg-white text-sol-azul grid place-items-center disabled:opacity-40 disabled:text-sol-gris">
                  <ChevronLeft size={17} />
                </button>
                <span className="text-xs font-extrabold text-sol-gris min-w-[72px] text-center">{paginaActualMenu} / {totalPaginasMenu}</span>
                <button type="button" onClick={() => cambiarPaginaMenu(paginaActualMenu + 1)} disabled={paginaActualMenu >= totalPaginasMenu}
                  className="h-9 w-9 rounded-xl border border-sol-borde bg-white text-sol-azul grid place-items-center disabled:opacity-40 disabled:text-sol-gris">
                  <ChevronRight size={17} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto pr-1">
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {productosPagina.map((p) => <ProductCard key={p.id} p={p} disponible={dispDe(p)} onAdd={agregar} />)}
            </div>
          </div>

          {filtrados.length > productosPorPagina && (
            <div className="mt-3 pt-3 border-t border-sol-borde flex items-center justify-center gap-1 shrink-0">
              {inicioPaginas > 1 && <span className="px-1 text-xs text-sol-gris">...</span>}
              {paginasVisibles.map((page) => (
                <button key={page} type="button" onClick={() => cambiarPaginaMenu(page)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-extrabold border ${page === paginaActualMenu ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-gris border-sol-borde"}`}>
                  {page}
                </button>
              ))}
              {totalPaginasMenu > 7 && <span className="px-1 text-xs text-sol-gris">...</span>}
            </div>
          )}
        </div>
        {!filtrados.length && <p className="text-sol-gris text-sm mt-8 text-center">No hay productos que coincidan con la búsqueda.</p>}
      </section>

      <CartPanel
        cart={cart} cliente={cliente} setCliente={setCliente} clientes={clientes} idCliente={idCliente} onSelectCliente={seleccionarCliente}
        pago={pago} setPago={setPago}
        pagoMixto={pagoMixto} setPagoMixto={setPagoMixto} pagos={pagos} setPagos={setPagos}
        metodosPago={METODOS_PAGO}
        descuentoGlobal={descuentoGlobal} setDescuentoGlobal={setDescuentoGlobal}
        totales={totales}
        onInc={inc} onDec={dec} onDel={quitar} onUpdateItem={actualizarItem}
        onCotizar={cotizar} onFacturar={generarFactura}
        onLimpiar={() => setConfirmarLimpiar(true)}
        onNuevoCliente={() => setNuevoCliente(true)}
      />

      {doc && <DocumentoPreview doc={doc} onClose={() => setDoc(null)} />}
      {nuevoCliente && (
        <ClienteForm
          inicial={{ nombre: cliente || "", documento: "", telefono: "", correo: "" }}
          onSave={guardarClienteRapido}
          onClose={() => setNuevoCliente(false)}
        />
      )}
      {confirmarLimpiar && (
        <ConfirmDialog
          titulo="Limpiar pedido"
          mensaje="¿Seguro que deseas cancelar todo el pedido actual? Se perderán los productos, descuentos y observaciones agregados."
          confirmar="Limpiar pedido"
          onConfirm={limpiarPedido}
          onClose={() => setConfirmarLimpiar(false)}
        />
      )}
    </div>
  );
}
