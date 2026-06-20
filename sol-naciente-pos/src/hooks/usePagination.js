import { useEffect, useMemo, useState } from "react";

// Pagina un arreglo en el cliente. Vuelve a la página 1 cuando cambia el
// conjunto de datos (p. ej. al cambiar un filtro o buscador).
export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => { setPage(1); }, [items.length, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return { page, setPage, totalPages, pageItems, pageSize };
}
