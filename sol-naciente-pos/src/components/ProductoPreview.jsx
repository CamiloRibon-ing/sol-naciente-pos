import { Modal, ModalHeader } from "./ui";
import ProductCard from "./ProductCard";
import { fmt, catNombre, catColor } from "../lib/format";

// Vista previa de un producto: cómo se ve en el punto de venta + datos de costo,
// margen y receta para quien administra el inventario.
export default function ProductoPreview({ producto, ingredientes, onClose }) {
  const utilidad = producto.precio - producto.costo;
  const margen = producto.precio ? Math.round((utilidad / producto.precio) * 100) : 0;
  const ingrediente = (id) => ingredientes.find((i) => i.id === id);

  return (
    <Modal onClose={onClose} max="max-w-md">
      <ModalHeader title="Vista previa del producto" onClose={onClose} />
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-bold text-sol-gris mb-2">Así se ve en el punto de venta</p>
          <div className="max-w-[230px] mx-auto">
            <ProductCard p={producto} disponible={Infinity} onAdd={() => {}} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Categoría</div>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold inline-block mt-1"
              style={{ background: catColor(producto.cat) + "1A", color: catColor(producto.cat) }}
            >
              {catNombre(producto.cat)}
            </span>
          </div>
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Estado</div>
            <div className="font-bold mt-1">{producto.activo !== false ? "Activo" : "Inactivo"}</div>
          </div>
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Costo</div>
            <div className="font-bold mt-1">{fmt(producto.costo)}</div>
          </div>
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Precio</div>
            <div className="font-bold mt-1">{fmt(producto.precio)}</div>
          </div>
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Utilidad</div>
            <div className="font-bold mt-1 text-sol-exito">{fmt(utilidad)}</div>
          </div>
          <div className="rounded-xl bg-sol-crema p-3">
            <div className="text-[11px] font-bold text-sol-gris">Margen</div>
            <div className="font-bold mt-1">{margen}%</div>
          </div>
        </div>

        {producto.controlaInventario && (producto.receta || []).length > 0 && (
          <div>
            <p className="text-xs font-extrabold text-sol-tinta mb-2">Receta (consumo de inventario)</p>
            <ul className="space-y-1">
              {producto.receta.map((r, i) => {
                const ing = ingrediente(r.ingredienteId);
                return (
                  <li key={i} className="flex justify-between text-sm rounded-lg bg-sol-crema px-3 py-2">
                    <span>{ing?.nombre || "—"}</span>
                    <span className="text-sol-gris">{r.cantidad} {ing?.unidad || ""}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {producto.desc && (
          <div>
            <p className="text-xs font-extrabold text-sol-tinta mb-1">Descripción</p>
            <p className="text-sm text-sol-gris">{producto.desc}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
