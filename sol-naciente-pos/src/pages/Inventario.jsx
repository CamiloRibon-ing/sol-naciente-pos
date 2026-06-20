import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Eye, Search, SlidersHorizontal, Package, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";
import { useStore } from "../context/StoreContext";
import { fmt, catNombre, catColor, margenInfo } from "../lib/format";
import { Boton, ConfirmDialog } from "../components/ui";
import Tabla from "../components/Tabla";
import ProductoForm from "../components/ProductoForm";
import IngredienteForm from "../components/IngredienteForm";
import ProductoPreview from "../components/ProductoPreview";
import AjusteStockForm from "../components/AjusteStockForm";
import CategoriaForm from "../components/CategoriaForm";

export default function Inventario() {
  const { productos, ingredientes, categorias, guardarCategoria, eliminarCategoria, guardarProducto, eliminarProducto, guardarIngrediente, eliminarIngrediente, ajustarStock } = useStore();
  const [tab, setTab] = useState("productos");
  const [editProd, setEditProd] = useState(undefined);
  const [editIng, setEditIng] = useState(undefined);
  const [editCat, setEditCat] = useState(undefined);
  const [previewProd, setPreviewProd] = useState(null);
  const [ajusteIng, setAjusteIng] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [cat, setCat] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const categoriasActivas = categorias.filter((c) => c.activo !== false);

  const onSaveProd = async (p) => {
    try { await guardarProducto(p); toast.success(p.id ? "Producto actualizado" : "Producto creado"); setEditProd(undefined); }
    catch (e) { toast.error(e.message || "No se pudo guardar"); }
  };
  const alternarProducto = async (p) => {
    const activo = p.activo !== false;
    try {
      await guardarProducto({ ...p, activo: !activo });
      toast.success(activo ? `"${p.nombre}" desactivado del punto de venta` : `"${p.nombre}" activado para vender`);
    } catch (e) {
      toast.error(e.message || "No se pudo cambiar el estado del producto");
    }
  };
  const onSaveIng = async (g) => {
    try { await guardarIngrediente(g); toast.success(g.id ? "Ingrediente actualizado" : "Ingrediente creado"); setEditIng(undefined); }
    catch (e) { toast.error(e.message || "No se pudo guardar"); }
  };
  const onSaveCat = async (c) => {
    try { await guardarCategoria(c); toast.success(c.uuid ? "Categoria actualizada" : "Categoria creada"); setEditCat(undefined); }
    catch (e) { toast.error(e.message || "No se pudo guardar la categoria"); }
  };
  const onAjusteStock = async (payload) => {
    try { await ajustarStock(payload); toast.success("Stock ajustado"); setAjusteIng(null); }
    catch (e) { toast.error(e.message || "No se pudo ajustar el stock"); }
  };
  const eliminar = async () => {
    const { tipo, id, nombre } = confirmar;
    try {
      if (tipo === "producto") await eliminarProducto(id);
      else if (tipo === "categoria") await eliminarCategoria(confirmar.categoria);
      else await eliminarIngrediente(id);
      toast.success(`"${nombre}" eliminado`);
    } catch (e) { toast.error(e.message || "No se pudo eliminar"); }
    finally { setConfirmar(null); }
  };

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) =>
      (cat === "todas" || p.cat === cat) &&
      (!q || p.nombre.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q))
    );
  }, [productos, cat, busqueda]);

  const ingredientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ingredientes.filter((g) => !q || g.nombre.toLowerCase().includes(q) || String(g.id).toLowerCase().includes(q));
  }, [ingredientes, busqueda]);

  const categoriasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return categorias.filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.descripcion || "").toLowerCase().includes(q));
  }, [categorias, busqueda]);

  const columnasProductos = [
    {
      key: "producto", label: "Producto",
      render: (p) => (
        <div className="flex items-center gap-2">
          {p.imagen && <img src={p.imagen} alt="" className="w-8 h-8 rounded-md object-cover" />}
          <div>
            <div className="font-bold">{p.nombre}</div>
            <div className="text-sol-grisClaro text-[11px] truncate max-w-xs">{p.desc}</div>
          </div>
        </div>
      ),
    },
    {
      key: "cat", label: "Categoría",
      render: (p) => <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: catColor(p.cat) + "1A", color: catColor(p.cat) }}>{catNombre(p.cat)}</span>,
    },
    { key: "costo", label: "Costo", align: "right", className: "text-sol-gris", render: (p) => fmt(p.costo) },
    { key: "precio", label: "Precio", align: "right", className: "font-bold", render: (p) => fmt(p.precio) },
    {
      key: "stock", label: "Stock", align: "right",
      render: (p) => {
        if (!p.controlaInventario) return <span className="text-sol-grisClaro">No controla</span>;
        if ((p.receta || []).length) return <span className="text-sol-grisClaro">Por receta</span>;
        const bajo = Number(p.stock || 0) <= Number(p.stockMin || 0);
        return <span className={`font-bold ${bajo ? "text-sol-rojo" : "text-sol-exito"}`}>{p.stock || 0}</span>;
      },
    },
    {
      key: "utilidad", label: "Utilidad", align: "right", className: "font-bold text-sol-exito",
      render: (p) => fmt(p.precio - p.costo),
    },
    {
      key: "margen", label: "Margen", align: "right",
      render: (p) => {
        const mg = p.precio ? Math.round(((p.precio - p.costo) / p.precio) * 100) : 0;
        const info = margenInfo(mg);
        return (
          <span className="inline-flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full" style={{ background: info.color }} />
            <span className="font-bold" style={{ color: info.color }}>{mg}%</span>
          </span>
        );
      },
    },
    {
      key: "estado", label: "Estado",
      render: (p) => {
        const activo = p.activo !== false;
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: (activo ? "#159A5A" : "#9AA1AD") + "1A", color: activo ? "#159A5A" : "#9AA1AD" }}>
            {activo ? "Activo" : "Inactivo"}
          </span>
        );
      },
    },
    {
      key: "acciones", label: "", align: "right",
      render: (p) => (
        <div className="whitespace-nowrap">
          <button onClick={() => setPreviewProd(p)} className="p-1.5"><Eye size={15} className="text-sol-gris" /></button>
          <button onClick={() => alternarProducto(p)} className="p-1.5" title={p.activo !== false ? "Desactivar producto" : "Activar producto"}>
            {p.activo !== false ? <ToggleRight size={16} className="text-sol-exito" /> : <ToggleLeft size={16} className="text-sol-gris" />}
          </button>
          <button onClick={() => setEditProd(p)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
          <button onClick={() => setConfirmar({ tipo: "producto", id: p.id, nombre: p.nombre })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
        </div>
      ),
    },
  ];

  const columnasIngredientes = [
    { key: "nombre", label: "Ingrediente", className: "font-bold", render: (g) => g.nombre },
    { key: "unidad", label: "Unidad", className: "text-sol-gris", render: (g) => g.unidad },
    { key: "costo", label: "Costo", align: "right", className: "text-sol-gris", render: (g) => fmt(g.costo) },
    { key: "stock", label: "Stock", align: "right", className: "font-bold", render: (g) => g.stock },
    { key: "stockMin", label: "Mínimo", align: "right", className: "text-sol-gris", render: (g) => g.stockMin },
    {
      key: "estado", label: "Estado",
      render: (g) => {
        const bajo = g.stock <= g.stockMin;
        return (
          <span className="rounded-full px-2 py-0.5 text-xs font-bold inline-flex items-center gap-1"
            style={{ background: (bajo ? "#E22B23" : "#159A5A") + "1A", color: bajo ? "#E22B23" : "#159A5A" }}>
            {bajo && <AlertTriangle size={11} />} {bajo ? "Crítico" : "OK"}
          </span>
        );
      },
    },
    {
      key: "acciones", label: "", align: "right",
      render: (g) => (
        <div className="whitespace-nowrap">
          <button onClick={() => setAjusteIng(g)} title="Ajustar stock" className="p-1.5"><SlidersHorizontal size={15} className="text-sol-azulOsc" /></button>
          <button onClick={() => setEditIng(g)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
          <button onClick={() => setConfirmar({ tipo: "ingrediente", id: g.id, nombre: g.nombre })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
        </div>
      ),
    },
  ];

  const columnasCategorias = [
    {
      key: "nombre", label: "Categoria",
      render: (c) => (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: c.color || "#1A4FA0" }} />
          <div>
            <div className="font-bold">{c.nombre}</div>
            <div className="text-sol-grisClaro text-[11px] truncate max-w-xs">{c.descripcion || "Sin descripcion"}</div>
          </div>
        </div>
      ),
    },
    { key: "productos", label: "Productos", align: "right", className: "font-bold", render: (c) => productos.filter((p) => p.cat === c.id).length },
    {
      key: "estado", label: "Estado",
      render: (c) => (
        <span className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: (c.activo !== false ? "#159A5A" : "#9AA1AD") + "1A", color: c.activo !== false ? "#159A5A" : "#9AA1AD" }}>
          {c.activo !== false ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "acciones", label: "", align: "right",
      render: (c) => (
        <div className="whitespace-nowrap">
          <button onClick={() => setEditCat(c)} className="p-1.5"><Pencil size={15} className="text-sol-azul" /></button>
          <button onClick={() => setConfirmar({ tipo: "categoria", id: c.uuid || c.id, nombre: c.nombre, categoria: c })} className="p-1.5"><Trash2 size={15} className="text-sol-rojo" /></button>
        </div>
      ),
    },
  ];

  return (
    <section className="flex-1 p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-extrabold text-2xl">Inventario</h1>
          <p className="text-sol-gris text-[13px]">Catálogo de productos e insumos con su costo y existencias.</p>
        </div>
        <Boton onClick={() => (tab === "productos" ? setEditProd(null) : tab === "ingredientes" ? setEditIng(null) : setEditCat(null))}>
          <Plus size={16} /> {tab === "productos" ? "Nuevo producto" : tab === "ingredientes" ? "Nuevo ingrediente" : "Nueva categoria"}
        </Boton>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ id: "productos", t: "Productos" }, { id: "ingredientes", t: "Ingredientes" }, { id: "categorias", t: "Categorias" }].map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold border ${tab === x.id ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde"}`}>
            {x.t}
          </button>
        ))}
      </div>

      <div className="relative mb-3 max-w-md">
        <Search size={17} className="text-sol-grisClaro absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder={tab === "productos" ? "Buscar por nombre, descripción o ID…" : "Buscar por nombre o ID…"}
          className="w-full rounded-xl pl-10 pr-3 py-2.5 text-sm border border-sol-borde bg-white focus:outline-none focus:border-sol-azul" />
      </div>

      {tab === "productos" && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[{ id: "todas", nombre: "Todas" }, ...categoriasActivas].map((c) => {
            const act = cat === c.id;
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition border ${act ? "bg-sol-azul text-white border-sol-azul" : "bg-white text-sol-tinta border-sol-borde hover:border-sol-azul"}`}>
                {c.nombre}
              </button>
            );
          })}
        </div>
      )}

      {tab === "productos" ? (
        <Tabla
          columns={columnasProductos}
          data={productosFiltrados}
          rowKey={(p) => p.id}
          minWidth="760px"
          emptyIcon={Package}
          emptyTitle="Sin productos"
          emptyMessage="No hay productos que coincidan con la búsqueda o el filtro."
        />
      ) : tab === "ingredientes" ? (
        <Tabla
          columns={columnasIngredientes}
          data={ingredientesFiltrados}
          rowKey={(g) => g.id}
          minWidth="600px"
          emptyIcon={Package}
          emptyTitle="Sin ingredientes"
          emptyMessage="No hay ingredientes que coincidan con la búsqueda."
        />
      ) : (
        <Tabla
          columns={columnasCategorias}
          data={categoriasFiltradas}
          rowKey={(c) => c.uuid || c.id}
          minWidth="620px"
          emptyIcon={Package}
          emptyTitle="Sin categorias"
          emptyMessage="No hay categorias que coincidan con la busqueda."
        />
      )}

      {editProd !== undefined && <ProductoForm inicial={editProd} ingredientes={ingredientes} categorias={categorias} onSave={onSaveProd} onClose={() => setEditProd(undefined)} />}
      {previewProd && <ProductoPreview producto={previewProd} ingredientes={ingredientes} onClose={() => setPreviewProd(null)} />}
      {editIng !== undefined && <IngredienteForm inicial={editIng} onSave={onSaveIng} onClose={() => setEditIng(undefined)} />}
      {editCat !== undefined && <CategoriaForm inicial={editCat} onSave={onSaveCat} onClose={() => setEditCat(undefined)} />}
      {ajusteIng && <AjusteStockForm ingrediente={ajusteIng} onSave={onAjusteStock} onClose={() => setAjusteIng(null)} />}
      {confirmar && (
        <ConfirmDialog
          titulo={`Eliminar ${confirmar.tipo}`}
          mensaje={`¿Seguro que deseas eliminar "${confirmar.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={eliminar}
          onClose={() => setConfirmar(null)}
        />
      )}
    </section>
  );
}
