import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePagination } from "../hooks/usePagination";
import EmptyState from "./EmptyState";

// Tabla genérica con columnas configurables, paginación y estado vacío.
// columns: [{ key, label, align: "left"|"right", className, render(row) }]
export default function Tabla({ columns, data, rowKey, pageSize = 10, minWidth = "640px", emptyIcon, emptyTitle, emptyMessage, rowClassName }) {
  const { page, setPage, totalPages, pageItems } = usePagination(data, pageSize);

  return (
    <div className="rounded-2xl bg-white overflow-x-auto border border-sol-borde">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead><tr className="bg-sol-suave text-sol-gris">
          {columns.map((c, i) => (
            <th key={i} className={`px-4 py-2.5 font-bold ${c.align === "right" ? "text-right" : "text-left"} ${c.thClassName || ""}`}>{c.label}</th>
          ))}
        </tr></thead>
        <tbody>
          {pageItems.map((row) => (
            <tr key={rowKey(row)} className={`border-t border-sol-suave ${rowClassName ? rowClassName(row) : ""}`}>
              {columns.map((c, i) => (
                <td key={i} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : ""} ${c.className || ""}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!data.length && <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />}

      {data.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-sol-borde text-xs text-sol-gris">
          <span>Página {page} de {totalPages} · {data.length} registros</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1 rounded-md border border-sol-borde disabled:opacity-30 hover:bg-sol-suave">
              <ChevronLeft size={15} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1 rounded-md border border-sol-borde disabled:opacity-30 hover:bg-sol-suave">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
