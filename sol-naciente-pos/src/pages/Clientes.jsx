import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, History, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt, fmtFecha } from "../lib/format";
import { Boton, ConfirmDialog, Modal, ModalHeader } from "../components/ui";
import ClienteForm from "../components/ClienteForm";
import DocumentoPreview from "../components/pdf/DocumentoPreview";

export default function Clientes() {
  const { clientes, guardarCliente, eliminarCliente, historialVentas, cargarHistorial } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [editar, setEditar] = useState(undefined);
  const [confirmar, setConfirmar] = useState(null);
  const [verHistorial, setVerHistorial] = useState(null);
  const [doc, setDoc] = useState(null);
  const [paginaClientes, setPaginaClientes] = useState(1);
  const clientesPorPagina = 12;

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const onSave = async (c) => {
    try { await guardarCliente(c); toast.success(c.id ? "Cliente actualizado" : "Cliente creado"); setEditar(undefined); }
    catch (e) { toast.error(e.message || "No se pudo guardar"); }
  };
  const eliminar = async () => {
    try { await eliminarCliente(confirmar.id); toast.success(`"${confirmar.nombre}" eliminado`); }
    catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    finally { setConfirmar(null); }
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes.filter((c) =>
      !q || c.nombre.toLowerCase().includes(q) || (c.documento || "").toLowerCase().includes(q) || (c.telefono || "").includes(q)
    );
  }, [clientes, busqueda]);

  const historialDe = (cliente) =>
    historialVentas.filter((v) => v.id_cliente === cliente.id || (v.cliente || "").toLowerCase() === cliente.nombre.toLowerCase());

  useEffect(() => {
    setPaginaClientes(1);
  }, [busqueda, filtrados.length]);

  const totalPaginasClientes = Math.max(1, Math.ceil(filtrados.length / clientesPorPagina));
  const paginaActualClientes = Math.min(paginaClientes, totalPaginasClientes);
  const inicioClientes = (paginaActualClientes - 1) * clientesPorPagina;
  const clientesPagina = filtrados.slice(inicioClientes, inicioClientes + clientesPorPagina);
  const finClientes = Math.min(filtrados.length, inicioClientes + clientesPorPagina);
  const inicioPaginasClientes = Math.max(1, Math.min(paginaActualClientes - 2, totalPaginasClientes - 4));
  const paginasClientes = Array.from({ length: Math.min(totalPaginasClientes, 5) }, (_, i) => inicioPaginasClientes + i);
  const cambiarPaginaClientes = (pagina) => setPaginaClientes(Math.max(1, Math.min(totalPaginasClientes, pagina)));

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Clientes</h1>
          <p className="text-sol-gris text-[13px]">Directorio de clientes y su historial de compras.</p>
        </div>
        <Boton onClick={() => setEditar(null)}><Plus size={16} /> Nuevo cliente</Boton>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={17} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, documento o teléfono…"
          className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
      </div>

      <div className="rounded-2xl bg-white border border-sol-borde">
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-b border-sol-borde">
          <h2 className="font-extrabold text-sm">Directorio de clientes</h2>
          {!!filtrados.length && (
            <span className="text-xs font-bold text-sol-gris">
              Mostrando {inicioClientes + 1}-{finClientes} de {filtrados.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="bg-sol-suave text-sol-gris">
            {["Cliente", "Documento", "Teléfono", "Correo", "Compras", ""].map((h, i) =>
              <th key={i} className={`px-4 py-2.5 font-bold ${i === 4 ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {clientesPagina.map((c) => {
              const compras = historialDe(c);
              return (
                <tr key={c.id} className="border-t border-sol-suave">
                  <td className="px-4 py-2.5 font-bold">{c.nombre}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{c.documento || "—"}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{c.telefono || "—"}</td>
                  <td className="px-4 py-2.5 text-sol-gris">{c.correo || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setVerHistorial(c)} className="inline-flex items-center gap-1 text-xs font-bold text-sol-azul hover:underline">
                      <History size={13} /> {compras.length}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditar(c)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
                    <button onClick={() => setConfirmar({ id: c.id, nombre: c.nombre })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtrados.length && <p className="text-sol-gris text-sm p-6 text-center">Aún no has registrado clientes.</p>}
        </div>
        {filtrados.length > clientesPorPagina && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-sol-borde">
            <button
              onClick={() => cambiarPaginaClientes(paginaActualClientes - 1)}
              disabled={paginaActualClientes === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-3 py-2 text-xs font-bold text-sol-gris disabled:opacity-40 disabled:cursor-not-allowed hover:border-sol-azul hover:text-sol-azul"
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <div className="flex items-center justify-center gap-1">
              {inicioPaginasClientes > 1 && <span className="px-1 text-xs text-sol-gris">...</span>}
              {paginasClientes.map((p) => (
                <button
                  key={p}
                  onClick={() => cambiarPaginaClientes(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-extrabold ${p === paginaActualClientes ? "bg-sol-azul text-white" : "border border-sol-borde text-sol-gris hover:border-sol-azul hover:text-sol-azul"}`}
                >
                  {p}
                </button>
              ))}
              {inicioPaginasClientes + paginasClientes.length - 1 < totalPaginasClientes && <span className="px-1 text-xs text-sol-gris">...</span>}
            </div>
            <button
              onClick={() => cambiarPaginaClientes(paginaActualClientes + 1)}
              disabled={paginaActualClientes === totalPaginasClientes}
              className="inline-flex items-center gap-1 rounded-lg border border-sol-borde px-3 py-2 text-xs font-bold text-sol-gris disabled:opacity-40 disabled:cursor-not-allowed hover:border-sol-azul hover:text-sol-azul"
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {editar !== undefined && <ClienteForm inicial={editar} onSave={onSave} onClose={() => setEditar(undefined)} />}

      {verHistorial && (
        <Modal onClose={() => setVerHistorial(null)} max="max-w-2xl">
          <ModalHeader title={`Historial de compras · ${verHistorial.nombre}`} onClose={() => setVerHistorial(null)} />
          <div className="p-4">
            {(() => {
              const compras = historialDe(verHistorial);
              const total = compras.filter((v) => v.estado !== "anulada").reduce((s, v) => s + v.total, 0);
              return (
                <>
                  <div className="rounded-xl bg-sol-suave p-3 mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-sol-azulOsc">Total comprado</span>
                    <span className="font-extrabold text-sol-azul">{fmt(total)}</span>
                  </div>
                  <div className="rounded-xl border border-sol-borde overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead><tr className="bg-sol-suave text-sol-gris">
                        {["N.º", "Fecha", "Pago", "Estado", "Total", ""].map((h, i) =>
                          <th key={i} className={`px-3 py-2 font-bold ${i === 4 ? "text-right" : "text-left"}`}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {compras.map((v) => (
                          <tr key={v.id} className="border-t border-sol-suave">
                            <td className="px-3 py-2 font-bold">{v.numero}</td>
                            <td className="px-3 py-2 text-sol-gris whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                            <td className="px-3 py-2 text-sol-gris">{v.pago}</td>
                            <td className="px-3 py-2">
                              <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                                style={{ background: (v.estado === "anulada" ? "#E22B23" : "#159A5A") + "1A", color: v.estado === "anulada" ? "#E22B23" : "#159A5A" }}>
                                {v.estado === "anulada" ? "Anulada" : "Pagada"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold">{fmt(v.total)}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => setDoc(v)} className="p-1"><Eye size={15} className="text-sol-gris" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!compras.length && <p className="text-sol-gris text-sm p-6 text-center">Este cliente aún no tiene compras registradas.</p>}
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {doc && <DocumentoPreview doc={doc} onClose={() => setDoc(null)} />}

      {confirmar && (
        <ConfirmDialog
          titulo="Eliminar cliente"
          mensaje={`¿Seguro que deseas eliminar "${confirmar.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={eliminar}
          onClose={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
