// Estado vacío reutilizable para tablas y listados sin resultados.
export default function EmptyState({ icon: Icon, title, message, action, onAction }) {
  return (
    <div className="text-center py-10 px-4">
      {Icon && <Icon size={30} className="mx-auto mb-2 text-sol-grisClaro" />}
      {title && <p className="font-bold text-sol-tinta text-sm">{title}</p>}
      {message && <p className="text-sol-gris text-xs mt-1">{message}</p>}
      {action && (
        <button onClick={onAction} className="mt-3 rounded-xl px-4 py-2 text-xs font-bold border border-sol-azul text-sol-azul hover:bg-sol-azul/5">
          {action}
        </button>
      )}
    </div>
  );
}
