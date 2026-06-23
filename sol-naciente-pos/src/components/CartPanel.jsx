import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Plus, Minus, Trash2, Receipt, FileText, CheckCircle2, X, Search, SplitSquareHorizontal, UserPlus } from "lucide-react";
import { fmt, formatoMontoInput, limpiarMonto } from "../lib/format";
import { useDebounce } from "../hooks/useDebounce";

export default function CartPanel({
  cart, cliente, setCliente, clientes = [], idCliente, onSelectCliente,
  pago, setPago, pagoMixto, setPagoMixto, pagos = [], setPagos, metodosPago = [],
  descuentoGlobal, setDescuentoGlobal, totales,
  onInc, onDec, onDel, onUpdateItem, onCotizar, onFacturar, onLimpiar, onNuevoCliente,
}) {
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [dineroRecibido, setDineroRecibido] = useState("");
  const qCliente = useDebounce(busquedaCliente, 200);

  const sugerencias = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || (c.documento || "").toLowerCase().includes(q)).slice(0, 6);
  }, [clientes, qCliente]);
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")),
    [clientes]
  );

  const { subtotalBruto, descuentoTotal, impuestos, total } = totales;
  const sumaPagos = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const difPagos = total - sumaPagos;
  const efectivoRecibido = limpiarMonto(dineroRecibido);
  const esEfectivoSimple = !pagoMixto && pago === "Efectivo";
  const cambioSimple = esEfectivoSimple ? Math.max(0, efectivoRecibido - total) : 0;
  const faltaSimple = esEfectivoSimple ? Math.max(0, total - efectivoRecibido) : 0;
  const efectivoMixto = pagos
    .filter((p) => String(p.metodo).toLowerCase() === "efectivo")
    .reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const excesoMixto = Math.max(0, sumaPagos - total);
  const cambioMixto = pagoMixto && excesoMixto > 0 && efectivoMixto >= excesoMixto ? excesoMixto : 0;
  const pagoMixtoValido = !pagoMixto || (pagos.some((p) => Number(p.monto) > 0) && (sumaPagos === total || (sumaPagos > total && efectivoMixto >= excesoMixto)));
  const pagoSimpleValido = !esEfectivoSimple || efectivoRecibido >= total;
  const puedeFacturar = cart.length > 0 && pagoMixtoValido && pagoSimpleValido;

  useEffect(() => {
    if (!cart.length || pagoMixto || pago !== "Efectivo") setDineroRecibido("");
  }, [cart.length, pagoMixto, pago]);

  const elegirCliente = (c) => {
    onSelectCliente?.(c.id);
    setBusquedaCliente("");
  };
  const elegirClientePorId = (id) => {
    const c = clientesOrdenados.find((x) => x.id === id);
    if (c) elegirCliente(c);
  };
  const limpiarCliente = () => {
    onSelectCliente?.(null);
    setCliente("");
    setBusquedaCliente("");
  };

  const setMontoPago = (i, monto) => setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, monto: limpiarMonto(monto) } : p)));
  const setMetodoPago = (i, metodo) => setPagos((ps) => ps.map((p, idx) => (idx === i ? { ...p, metodo } : p)));
  const completarPagoFaltante = () => {
    if (pagos.length && difPagos > 0) setMontoPago(pagos.length - 1, (Number(pagos[pagos.length - 1].monto) || 0) + difPagos);
  };

  return (
    <aside className="xl:w-[430px] shrink-0 bg-white border-l border-sol-borde overflow-auto">
      <div className="p-4 flex items-center gap-2 border-b border-sol-borde">
        <Receipt size={21} className="text-sol-azul" />
        <h2 className="font-extrabold text-xl text-sol-tinta">Pedido actual</h2>
        {cart.length > 0 && <span className="ml-auto text-xs font-bold rounded-full px-2 py-0.5 bg-sol-suave text-sol-azul">{cart.length} ítems</span>}
        {cart.length > 0 && (
          <button onClick={onLimpiar} title="Limpiar pedido" className="text-xs font-bold text-sol-rojo hover:underline flex items-center gap-1">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      <div className="overflow-auto p-3 min-h-[8rem] max-h-[42vh] xl:max-h-[46vh]">
        {!cart.length && (
          <div className="text-center mt-10 text-sol-grisClaro">
            <ShoppingCart size={34} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Agrega productos del menú</p>
          </div>
        )}
        {cart.map((l) => (
          <div key={l.id} className="py-2 border-b border-sol-suave">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[15px] truncate text-sol-tinta">{l.nombre}</div>
                <div className="text-sol-gris text-sm font-bold">{fmt(l.precio)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onDec(l.id)} className="rounded-md p-1 bg-sol-suave hover:bg-sol-borde"><Minus size={13} /></button>
                <span className="font-extrabold text-base text-center min-w-[22px]">{l.cantidad}</span>
                <button onClick={() => onInc(l.id)} className="rounded-md p-1 bg-sol-suave hover:bg-sol-borde"><Plus size={13} /></button>
              </div>
              <div className="font-extrabold text-[15px] text-right min-w-[78px] text-sol-azul">{fmt(l.precio * l.cantidad)}</div>
              <button onClick={() => onDel(l.id)}><Trash2 size={14} className="text-sol-rojo" /></button>
            </div>
            <div className="flex items-center gap-2 mt-1.5 pl-0.5">
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={l.descuento || ""} placeholder="0"
                  onChange={(e) => onUpdateItem(l.id, { descuento: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="w-12 rounded-md px-1.5 py-1 text-[11px] border border-sol-borde bg-sol-crema focus:outline-none focus:border-sol-azul text-right" />
                <span className="text-[11px] text-sol-gris">% desc.</span>
              </div>
              <input value={l.nota || ""} onChange={(e) => onUpdateItem(l.id, { nota: e.target.value })} placeholder="Observación (ej. sin cebolla)"
                className="flex-1 rounded-md px-2 py-1 text-[11px] border border-sol-borde bg-sol-crema focus:outline-none focus:border-sol-azul" />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-3 border-t border-sol-borde bg-sol-crema">
        <div className="relative rounded-2xl border border-sol-borde bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-extrabold uppercase text-sol-azulOsc">Datos del cliente</span>
            <button type="button" onClick={onNuevoCliente}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-sol-azul hover:bg-sol-crema">
              <UserPlus size={12} /> Registrar rapido
            </button>
          </div>
          {idCliente ? (
            <div className="flex items-center justify-between rounded-xl px-3 py-3 text-sm border border-sol-azul bg-sol-azul/5">
              <span className="font-bold truncate">{cliente}</span>
              <button onClick={limpiarCliente}><X size={14} className="text-sol-gris" /></button>
            </div>
          ) : (
            <>
              <select
                value=""
                onChange={(e) => elegirClientePorId(e.target.value)}
                className="w-full rounded-xl px-3 py-3 text-sm font-bold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul mb-2">
                <option value="">Seleccionar cliente registrado</option>
                {clientesOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.documento ? ` - ${c.documento}` : ""}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search size={14} className="text-sol-grisClaro absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={busquedaCliente || cliente}
                  onChange={(e) => { setBusquedaCliente(e.target.value); setCliente(e.target.value); }}
                  placeholder="Buscar cliente o escribir nombre…"
                  className="w-full rounded-xl pl-8 pr-3 py-3 text-sm font-bold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
              </div>
              {sugerencias.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-sol-borde bg-white shadow-md overflow-hidden">
                  {sugerencias.map((c) => (
                    <button key={c.id} onClick={() => elegirCliente(c)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-sol-suave flex justify-between gap-2">
                      <span className="font-bold truncate">{c.nombre}</span>
                      {c.documento && <span className="text-sol-gris">{c.documento}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-sol-borde bg-white p-3 space-y-3">
        <h3 className="text-sm font-extrabold uppercase text-sol-azulOsc">Datos de venta</h3>
        <div className="flex items-center gap-2">
          <input type="number" min="0" max="100" value={descuentoGlobal || ""} placeholder="0"
            onChange={(e) => setDescuentoGlobal(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="w-20 rounded-xl px-2 py-2.5 text-sm font-bold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul text-right" />
          <span className="text-sm font-bold text-sol-gris">% descuento general del pedido</span>
        </div>

        <button onClick={() => setPagoMixto(!pagoMixto)}
          className={`w-full flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold border transition ${pagoMixto ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-azul border-sol-borde hover:border-sol-azul"}`}>
          <SplitSquareHorizontal size={13} /> {pagoMixto ? "Pago mixto activado" : "Activar pago mixto"}
        </button>

        {pagoMixto ? (
          <div className="space-y-1.5">
            {pagos.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <select value={p.metodo} onChange={(e) => setMetodoPago(i, e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-sm font-bold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
                  {metodosPago.map((x) => <option key={x}>{x}</option>)}
                </select>
                <input inputMode="numeric" value={p.monto ? formatoMontoInput(p.monto) : ""} onChange={(e) => setMontoPago(i, e.target.value)} placeholder="Monto"
                  className="rounded-xl px-3 py-2.5 text-sm font-bold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul text-right" />
              </div>
            ))}
            <div className={`flex justify-between text-xs font-bold ${difPagos === 0 ? "text-sol-exito" : "text-sol-rojo"}`}>
              <span>{difPagos === 0 ? "Pagos completos" : difPagos > 0 ? "Falta por asignar" : cambioMixto > 0 ? "Cambio por dar" : "Excede el total"}</span>
              <span className="flex items-center gap-1">
                {fmt(Math.abs(difPagos))}
                {difPagos > 0 && <button onClick={completarPagoFaltante} className="underline">ajustar</button>}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <select value={pago} onChange={(e) => setPago(e.target.value)}
              className="w-full rounded-xl px-3 py-3 text-sm font-extrabold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul">
              {metodosPago.map((x) => <option key={x}>{x}</option>)}
            </select>
            {pago === "Efectivo" && (
              <div className="rounded-2xl border border-sol-borde bg-sol-crema p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-sol-tinta">Dinero recibido</span>
                  <input inputMode="numeric" value={dineroRecibido} onChange={(e) => setDineroRecibido(formatoMontoInput(e.target.value))} placeholder="0"
                    className="w-40 rounded-xl px-3 py-2.5 text-base font-extrabold border border-sol-borde bg-white focus:outline-none focus:border-sol-azul text-right" />
                </div>
                <div className={`flex justify-between text-base font-extrabold ${faltaSimple > 0 ? "text-sol-rojo" : "text-sol-exito"}`}>
                  <span>{faltaSimple > 0 ? "Falta recibir" : "Cambio por dar"}</span>
                  <span>{fmt(faltaSimple > 0 ? faltaSimple : cambioSimple)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {pagoMixto && cambioMixto > 0 && (
          <div className="rounded-xl bg-sol-exito/10 text-sol-exito px-3 py-2 text-base font-extrabold flex justify-between">
            <span>Cambio por dar</span><span>{fmt(cambioMixto)}</span>
          </div>
        )}
        </div>

        <div className="text-sm space-y-1 rounded-2xl border border-sol-borde bg-white p-3">
          <div className="flex justify-between text-sol-gris"><span>Subtotal</span><span>{fmt(subtotalBruto)}</span></div>
          {descuentoTotal > 0 && (
            <div className="flex justify-between text-sol-rojo"><span>Descuentos</span><span>- {fmt(descuentoTotal)}</span></div>
          )}
          <div className="flex justify-between text-sol-gris"><span>Impoconsumo 8%</span><span>{fmt(impuestos)}</span></div>
          <div className="flex justify-between text-xl font-extrabold pt-1 text-sol-azul"><span>Total</span><span>{fmt(total)}</span></div>
        </div>
        <div className="flex gap-2">
          <button disabled={!cart.length} onClick={onCotizar}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 border border-sol-azul text-sol-azul hover:bg-sol-azul/5 disabled:opacity-40 disabled:cursor-not-allowed">
            <FileText size={15} /> Cotización
          </button>
          <button disabled={!puedeFacturar} onClick={onFacturar}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-1.5 bg-sol-rojo hover:bg-sol-rojoOsc disabled:opacity-40 disabled:cursor-not-allowed">
            <CheckCircle2 size={15} /> Facturar
          </button>
        </div>
      </div>
    </aside>
  );
}
