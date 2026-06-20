MÓDULOS COMPLETOS FALTANTES
1. LOGIN Y AUTENTICACIÓN
Carpeta: src/pages/Login.jsx + src/context/AuthContext.jsx + src/components/RutaProtegida.jsx

Pantalla de login con logo, email y contraseña
Manejo de sesión con Supabase Auth
Roles: admin (acceso total), cajero (solo POS), supervisor (POS + dashboard)
Cierre de sesión en el sidebar
Ruta protegida que redirige al login si no hay sesión
Toast de bienvenida al entrar, error si credenciales incorrectas
Estado de "cargando sesión" al iniciar la app



2. MÓDULO DE RESERVAS (APARTAMENTOS Y EVENTOS)
Carpeta: src/pages/Reservas.jsx + src/components/ReservaForm.jsx + src/components/Calendario.jsx

Vista de calendario mensual con las reservas activas por color
Formulario de nueva reserva: cliente, tipo (apartamento/cabaña/kiosko/salón), fechas de entrada y salida, número de personas, observaciones, anticipo
Estados de reserva: pendiente, confirmada, en curso, finalizada, cancelada
Verificación de disponibilidad por fechas (no permitir doble reserva del mismo espacio)
Botón para convertir reserva en factura cuando el cliente llega
Historial de reservas con filtros por estado y rango de fechas
Toast al crear, confirmar o cancelar reserva



3. MÓDULO DE CAJA
Carpeta: src/pages/Caja.jsx + src/components/MovimientoCajaForm.jsx

Apertura de caja con monto inicial en efectivo
Cierre de caja: resumen del día (ventas por método de pago, entradas, salidas, saldo esperado vs real)
Registro de gastos/egresos durante el día (mantenimiento, compras menores, etc.)
Registro de ingresos no relacionados con ventas
Historial de movimientos de la caja del día con timestamps
Botón de imprimir/descargar el cuadre del día como PDF
Alerta si la caja ya fue abierta o cerrada



4. MÓDULO DE COMPRAS Y PROVEEDORES
Carpeta: src/pages/Compras.jsx + src/components/CompraForm.jsx + src/pages/Proveedores.jsx + src/components/ProveedorForm.jsx

CRUD completo de proveedores (nombre, NIT, teléfono, contacto, productos que suministra)
Registro de compras: seleccionar proveedor, agregar ingredientes con cantidad y precio de compra, fecha, número de factura del proveedor
Al guardar una compra se incrementa el stock automáticamente en inventario
Actualización del costo del ingrediente con el precio de la última compra
Historial de compras con filtro por proveedor y rango de fechas
Totales de lo comprado en el período



5. MÓDULO DE NÓMINA
Carpeta: src/pages/Nomina.jsx + src/components/EmpleadoForm.jsx + src/components/PeriodoNominaForm.jsx

CRUD de empleados: nombre, cargo, tipo de contrato, salario base, fecha de ingreso
Creación de período de nómina (quincenal o mensual)
Por empleado: salario base, horas extra, bonificaciones, deducciones (salud, pensión), préstamos, neto a pagar
Cálculo automático de aportes según normativa colombiana (salud 4%, pensión 4%)
Liquidación del período con resumen por empleado
Descarga del comprobante de pago por empleado en PDF con logo


6. HISTORIAL DE VENTAS Y REIMPRESIÓN
Carpeta: src/pages/Ventas.jsx

Lista de todas las ventas/facturas con: número, fecha, cliente, método de pago, total
Filtros por rango de fechas, método de pago, cajero
Buscador por número de factura o nombre de cliente
Botón "Ver" que abre la vista previa del PDF de esa factura para reimprimir o reenviar
Anular venta (cambia estado a anulada, no elimina, devuelve stock)
Exportar listado a CSV o Excel

7. MÓDULO DE CLIENTES
Carpeta: src/pages/Clientes.jsx + src/components/ClienteForm.jsx

CRUD de clientes: nombre, cédula/NIT, teléfono, correo, dirección
Historial de compras del cliente
Saldo de anticipos o crédito disponible
Buscador rápido en el POS que autocomplete el campo "Cliente" con la base de datos
Al seleccionar cliente en el POS se llena automáticamente nombre y NIT en la factura

8. DASHBOARD AMPLIADO
Sección adicional dentro de: src/pages/Dashboard.jsx

Selector de período: hoy, esta semana, este mes, rango personalizado
Tabla de estado de resultados del período: ingresos por categoría, costo de ventas, utilidad bruta, gastos, utilidad neta
Comparativo mes actual vs mes anterior en la gráfica de líneas
Indicador de margen de ganancia por categoría
Costo total de nómina del período vs ingresos
Exportar reporte del período en PDF con logo



FUNCIONALIDADES FALTANTES EN MÓDULOS YA CREADOS
En Punto de Venta (src/pages/PuntoVenta.jsx)

El buscador de clientes no consulta la base de datos, solo es un campo de texto libre. Falta autocompletado con la tabla de clientes.
No hay botón de "Limpiar pedido" para cancelar todo el carrito de una vez con confirmación.
No hay campo de descuento por ítem ni descuento global al pedido.
No hay campo de observaciones por ítem (ej. "sin cebolla").
Falta la opción de pago mixto (ej. parte efectivo + parte tarjeta).
No hay notificación de "stock bajo" cuando un producto queda con menos de 3 disponibles tras agregarlo.

En Inventario (src/pages/Inventario.jsx)

No hay ajuste manual de stock con motivo (diferencia en conteo físico, merma, daño). Falta src/components/AjusteStockForm.jsx.
No hay filtro por categoría ni buscador en la tabla de productos.
No hay indicador visual del margen de ganancia (bueno/regular/malo) con colores.
La tabla no tiene paginación ni manejo de muchos registros.
Falta la opción de desactivar un producto (ocultarlo del menú sin eliminarlo) con toggle.

En el PDF de factura (src/components/pdf/DocumentoPDF.jsx)

Falta campo de NIT del cliente cuando es empresa (factura B2B).
Falta número de autorización o resolución DIAN (aunque sea placeholder por ahora).
No hay detalle de descuentos aplicados si se implementa esa funcionalidad.
Falta el código QR de verificación (futuro, pero el espacio debería estar reservado).

En el sidebar/layout (src/App.jsx)

No muestra el nombre del usuario logueado.
No hay indicador de estado de la caja (abierta/cerrada) visible permanentemente.
No hay acceso rápido a "Caja" desde el topbar.
Falta badge de alertas (inventario crítico) en el ícono de inventario del sidebar.


ARCHIVOS DE CONFIGURACIÓN Y SOPORTE FALTANTES

src/lib/pdf.js — helpers compartidos para generar PDFs (colores, estilos base, función de descarga) que hoy están duplicados entre factura y comprobante de nómina.
src/hooks/useDebounce.js — para el buscador de clientes en el POS sin hacer una petición por letra.
src/hooks/usePagination.js — para tablas con muchos registros.
supabase/rls.sql — políticas de seguridad Row Level Security de Supabase (actualmente el schema las tiene como comentarios pero hay que definirlas).
supabase/seed.sql — INSERT iniciales de categorías, métodos de pago, bodega, punto de venta y un usuario admin para que la base de datos arranque con los datos base.
src/components/EmptyState.jsx — componente reutilizable para tablas vacías con ícono y botón de acción.
src/components/Tabla.jsx — tabla genérica con paginación, buscador y columnas configurables para reutilizar en Ventas, Clientes, Compras, Nómina.


ORDEN RECOMENDADO PARA IMPLEMENTAR

Login y autenticación — sin esto cualquier otro módulo es inseguro
Historial de ventas y reimpresión — es lo que más usa un negocio real desde el día uno
Módulo de caja — fundamental para el cuadre diario
Clientes con autocompletado en el POS
Compras y proveedores — cierra el ciclo de inventario
Reservas con calendario
Nómina
Dashboard ampliado con períodos y exportación
Ajustes finos: descuentos, pago mixto, RLS de Supabase, seed.sql








-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.roles (
  id_rol uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_rol text NOT NULL UNIQUE,
  descripcion text,
  CONSTRAINT roles_pkey PRIMARY KEY (id_rol)
);
CREATE TABLE public.usuarios (
  id_usuario uuid NOT NULL,
  nombre text NOT NULL,
  correo text NOT NULL UNIQUE,
  id_rol uuid,
  id_punto uuid,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario),
  CONSTRAINT usuarios_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES auth.users(id),
  CONSTRAINT usuarios_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles(id_rol),
  CONSTRAINT usuarios_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.puntos_venta(id_punto)
);
CREATE TABLE public.bodegas (
  id_bodega uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT bodegas_pkey PRIMARY KEY (id_bodega)
);
CREATE TABLE public.puntos_venta (
  id_punto uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ubicacion text,
  id_bodega uuid,
  id_punto_padre uuid,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT puntos_venta_pkey PRIMARY KEY (id_punto),
  CONSTRAINT puntos_venta_id_bodega_fkey FOREIGN KEY (id_bodega) REFERENCES public.bodegas(id_bodega),
  CONSTRAINT puntos_venta_id_punto_padre_fkey FOREIGN KEY (id_punto_padre) REFERENCES public.puntos_venta(id_punto)
);

Los kioscos operativos (`Kiosco piscina` y `Kiosco micheladas`) deben guardar su venta y caja con su propio `id_punto`, pero su `id_punto_padre` apunta a `Punto de venta principal` (`133c2615-8213-4e2b-8a8d-1d6ec31499fb`) para consolidar la contabilidad del negocio.
CREATE TABLE public.categorias (
  id_categoria uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_categoria text NOT NULL UNIQUE,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT categorias_pkey PRIMARY KEY (id_categoria)
);
CREATE TABLE public.productos (
  id_producto uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  id_categoria uuid,
  tipo USER-DEFINED NOT NULL DEFAULT 'comida'::tipo_producto,
  precio_venta numeric NOT NULL CHECK (precio_venta >= 0::numeric),
  costo_estimado numeric NOT NULL DEFAULT 0,
  imagen_url text,
  controla_inventario boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id_producto),
  CONSTRAINT productos_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias(id_categoria)
);
CREATE TABLE public.ingredientes (
  id_ingrediente uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad_medida text NOT NULL,
  costo_unitario numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ingredientes_pkey PRIMARY KEY (id_ingrediente)
);
CREATE TABLE public.inventario (
  id_inventario uuid NOT NULL DEFAULT gen_random_uuid(),
  id_ingrediente uuid NOT NULL,
  id_bodega uuid NOT NULL,
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventario_pkey PRIMARY KEY (id_inventario),
  CONSTRAINT inventario_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingredientes(id_ingrediente),
  CONSTRAINT inventario_id_bodega_fkey FOREIGN KEY (id_bodega) REFERENCES public.bodegas(id_bodega)
);
CREATE TABLE public.movimientos_inventario (
  id_movimiento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_ingrediente uuid NOT NULL,
  id_bodega uuid NOT NULL,
  tipo USER-DEFINED NOT NULL,
  cantidad numeric NOT NULL,
  costo_unitario numeric,
  referencia text,
  id_usuario uuid,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id_movimiento),
  CONSTRAINT movimientos_inventario_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingredientes(id_ingrediente),
  CONSTRAINT movimientos_inventario_id_bodega_fkey FOREIGN KEY (id_bodega) REFERENCES public.bodegas(id_bodega),
  CONSTRAINT movimientos_inventario_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.recetas (
  id_receta uuid NOT NULL DEFAULT gen_random_uuid(),
  id_producto uuid NOT NULL,
  id_ingrediente uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0::numeric),
  CONSTRAINT recetas_pkey PRIMARY KEY (id_receta),
  CONSTRAINT recetas_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto),
  CONSTRAINT recetas_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingredientes(id_ingrediente)
);
CREATE TABLE public.clientes (
  id_cliente uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  documento text,
  telefono text,
  correo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clientes_pkey PRIMARY KEY (id_cliente)
);
CREATE TABLE public.proveedores (
  id_proveedor uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  nit text,
  telefono text,
  correo text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT proveedores_pkey PRIMARY KEY (id_proveedor)
);
CREATE TABLE public.metodos_pago (
  id_metodo uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT metodos_pago_pkey PRIMARY KEY (id_metodo)
);
CREATE TABLE public.apartamentos (
  id_apartamento uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  capacidad integer,
  precio_dia numeric,
  precio_fin_semana numeric,
  imagen_url text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT apartamentos_pkey PRIMARY KEY (id_apartamento)
);
CREATE TABLE public.espacios_evento (
  id_espacio uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  capacidad integer,
  precio_base numeric,
  imagen_url text,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT espacios_evento_pkey PRIMARY KEY (id_espacio)
);
CREATE TABLE public.reservas (
  id_reserva uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo USER-DEFINED NOT NULL,
  id_apartamento uuid,
  id_espacio uuid,
  id_cliente uuid,
  id_usuario uuid,
  fecha_inicio timestamp with time zone NOT NULL,
  fecha_fin timestamp with time zone NOT NULL,
  num_personas integer,
  monto_total numeric NOT NULL DEFAULT 0,
  estado USER-DEFINED NOT NULL DEFAULT 'pendiente'::estado_reserva,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservas_pkey PRIMARY KEY (id_reserva),
  CONSTRAINT reservas_id_apartamento_fkey FOREIGN KEY (id_apartamento) REFERENCES public.apartamentos(id_apartamento),
  CONSTRAINT reservas_id_espacio_fkey FOREIGN KEY (id_espacio) REFERENCES public.espacios_evento(id_espacio),
  CONSTRAINT reservas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente),
  CONSTRAINT reservas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.cajas (
  id_caja uuid NOT NULL DEFAULT gen_random_uuid(),
  id_punto uuid NOT NULL,
  id_usuario_apertura uuid,
  monto_inicial numeric NOT NULL DEFAULT 0,
  fecha_apertura timestamp with time zone NOT NULL DEFAULT now(),
  id_usuario_cierre uuid,
  monto_final_esperado numeric,
  monto_final_real numeric,
  diferencia numeric,
  fecha_cierre timestamp with time zone,
  estado USER-DEFINED NOT NULL DEFAULT 'abierta'::estado_caja,
  CONSTRAINT cajas_pkey PRIMARY KEY (id_caja),
  CONSTRAINT cajas_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.puntos_venta(id_punto),
  CONSTRAINT cajas_id_usuario_apertura_fkey FOREIGN KEY (id_usuario_apertura) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT cajas_id_usuario_cierre_fkey FOREIGN KEY (id_usuario_cierre) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.movimientos_caja (
  id_movimiento uuid NOT NULL DEFAULT gen_random_uuid(),
  id_caja uuid NOT NULL,
  tipo USER-DEFINED NOT NULL,
  descripcion text,
  monto numeric NOT NULL,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  id_usuario uuid,
  CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id_movimiento),
  CONSTRAINT movimientos_caja_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas(id_caja),
  CONSTRAINT movimientos_caja_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.ventas (
  id_venta uuid NOT NULL DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_punto uuid NOT NULL,
  id_caja uuid,
  id_usuario uuid,
  id_cliente uuid,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  subtotal numeric NOT NULL DEFAULT 0,
  descuento numeric NOT NULL DEFAULT 0,
  impuestos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado USER-DEFINED NOT NULL DEFAULT 'pagada'::estado_venta,
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ventas_pkey PRIMARY KEY (id_venta),
  CONSTRAINT ventas_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.puntos_venta(id_punto),
  CONSTRAINT ventas_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas(id_caja),
  CONSTRAINT ventas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT ventas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente)
);
CREATE TABLE public.detalle_venta (
  id_detalle uuid NOT NULL DEFAULT gen_random_uuid(),
  id_venta uuid NOT NULL,
  id_producto uuid,
  id_reserva uuid,
  descripcion text,
  cantidad numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0::numeric),
  precio_unitario numeric NOT NULL,
  descuento numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL,
  CONSTRAINT detalle_venta_pkey PRIMARY KEY (id_detalle),
  CONSTRAINT detalle_venta_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta),
  CONSTRAINT detalle_venta_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto),
  CONSTRAINT detalle_venta_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reservas(id_reserva)
);
CREATE TABLE public.pagos (
  id_pago uuid NOT NULL DEFAULT gen_random_uuid(),
  id_venta uuid,
  id_reserva uuid,
  id_metodo uuid NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0::numeric),
  referencia text,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagos_pkey PRIMARY KEY (id_pago),
  CONSTRAINT pagos_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas(id_venta),
  CONSTRAINT pagos_id_reserva_fkey FOREIGN KEY (id_reserva) REFERENCES public.reservas(id_reserva),
  CONSTRAINT pagos_id_metodo_fkey FOREIGN KEY (id_metodo) REFERENCES public.metodos_pago(id_metodo)
);
CREATE TABLE public.compras (
  id_compra uuid NOT NULL DEFAULT gen_random_uuid(),
  id_proveedor uuid,
  id_bodega uuid NOT NULL,
  id_usuario uuid,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  numero_factura text,
  subtotal numeric NOT NULL DEFAULT 0,
  impuestos numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT compras_pkey PRIMARY KEY (id_compra),
  CONSTRAINT compras_id_proveedor_fkey FOREIGN KEY (id_proveedor) REFERENCES public.proveedores(id_proveedor),
  CONSTRAINT compras_id_bodega_fkey FOREIGN KEY (id_bodega) REFERENCES public.bodegas(id_bodega),
  CONSTRAINT compras_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.detalle_compra (
  id_detalle_compra uuid NOT NULL DEFAULT gen_random_uuid(),
  id_compra uuid NOT NULL,
  id_ingrediente uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0::numeric),
  costo_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  CONSTRAINT detalle_compra_pkey PRIMARY KEY (id_detalle_compra),
  CONSTRAINT detalle_compra_id_compra_fkey FOREIGN KEY (id_compra) REFERENCES public.compras(id_compra),
  CONSTRAINT detalle_compra_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingredientes(id_ingrediente)
);
CREATE TABLE public.categorias_gasto (
  id_categoria_gasto uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  CONSTRAINT categorias_gasto_pkey PRIMARY KEY (id_categoria_gasto)
);
CREATE TABLE public.gastos (
  id_gasto uuid NOT NULL DEFAULT gen_random_uuid(),
  id_categoria_gasto uuid,
  id_punto uuid,
  descripcion text,
  monto numeric NOT NULL CHECK (monto >= 0::numeric),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  id_usuario uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gastos_pkey PRIMARY KEY (id_gasto),
  CONSTRAINT gastos_id_categoria_gasto_fkey FOREIGN KEY (id_categoria_gasto) REFERENCES public.categorias_gasto(id_categoria_gasto),
  CONSTRAINT gastos_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.puntos_venta(id_punto),
  CONSTRAINT gastos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.cargos (
  id_cargo uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  salario_base numeric,
  CONSTRAINT cargos_pkey PRIMARY KEY (id_cargo)
);
CREATE TABLE public.empleados (
  id_empleado uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid,
  nombre text NOT NULL,
  documento text,
  id_cargo uuid,
  salario_base numeric,
  tipo_contrato text,
  fecha_ingreso date,
  fecha_retiro date,
  telefono text,
  correo text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT empleados_pkey PRIMARY KEY (id_empleado),
  CONSTRAINT empleados_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario),
  CONSTRAINT empleados_id_cargo_fkey FOREIGN KEY (id_cargo) REFERENCES public.cargos(id_cargo)
);
CREATE TABLE public.periodos_nomina (
  id_periodo uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  tipo text,
  estado USER-DEFINED NOT NULL DEFAULT 'abierto'::estado_periodo_nomina,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT periodos_nomina_pkey PRIMARY KEY (id_periodo)
);
CREATE TABLE public.conceptos_nomina (
  id_concepto uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo USER-DEFINED NOT NULL,
  es_porcentaje boolean NOT NULL DEFAULT false,
  valor_default numeric,
  CONSTRAINT conceptos_nomina_pkey PRIMARY KEY (id_concepto)
);
CREATE TABLE public.nomina_detalle (
  id_nomina_detalle uuid NOT NULL DEFAULT gen_random_uuid(),
  id_periodo uuid NOT NULL,
  id_empleado uuid NOT NULL,
  dias_trabajados numeric,
  total_devengado numeric NOT NULL DEFAULT 0,
  total_deducciones numeric NOT NULL DEFAULT 0,
  neto_pagar numeric DEFAULT (total_devengado - total_deducciones),
  fecha_pago date,
  CONSTRAINT nomina_detalle_pkey PRIMARY KEY (id_nomina_detalle),
  CONSTRAINT nomina_detalle_id_periodo_fkey FOREIGN KEY (id_periodo) REFERENCES public.periodos_nomina(id_periodo),
  CONSTRAINT nomina_detalle_id_empleado_fkey FOREIGN KEY (id_empleado) REFERENCES public.empleados(id_empleado)
);
CREATE TABLE public.nomina_conceptos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_nomina_detalle uuid NOT NULL,
  id_concepto uuid NOT NULL,
  valor numeric NOT NULL,
  CONSTRAINT nomina_conceptos_pkey PRIMARY KEY (id),
  CONSTRAINT nomina_conceptos_id_nomina_detalle_fkey FOREIGN KEY (id_nomina_detalle) REFERENCES public.nomina_detalle(id_nomina_detalle),
  CONSTRAINT nomina_conceptos_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.conceptos_nomina(id_concepto)
);
CREATE TABLE public.plan_cuentas (
  id_cuenta uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  tipo text NOT NULL,
  naturaleza text NOT NULL,
  CONSTRAINT plan_cuentas_pkey PRIMARY KEY (id_cuenta)
);
CREATE TABLE public.asientos_contables (
  id_asiento uuid NOT NULL DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  descripcion text,
  referencia text,
  id_usuario uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asientos_contables_pkey PRIMARY KEY (id_asiento),
  CONSTRAINT asientos_contables_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);
CREATE TABLE public.movimientos_contables (
  id_mov uuid NOT NULL DEFAULT gen_random_uuid(),
  id_asiento uuid NOT NULL,
  id_cuenta uuid NOT NULL,
  debito numeric NOT NULL DEFAULT 0,
  credito numeric NOT NULL DEFAULT 0,
  CONSTRAINT movimientos_contables_pkey PRIMARY KEY (id_mov),
  CONSTRAINT movimientos_contables_id_asiento_fkey FOREIGN KEY (id_asiento) REFERENCES public.asientos_contables(id_asiento),
  CONSTRAINT movimientos_contables_id_cuenta_fkey FOREIGN KEY (id_cuenta) REFERENCES public.plan_cuentas(id_cuenta)
);
CREATE TABLE public.auditoria (
  id_auditoria uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid,
  accion text,
  tabla_afectada text,
  registro_id text,
  detalle jsonb,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria),
  CONSTRAINT auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario)
);








Auditoría: quién creó, editó, anuló ventas, cambió stock o cerró caja.
Gastos operativos: servicios, mantenimiento, compras menores, publicidad.
Reportes por vendedor: ventas, métodos de pago, anulaciones y cierre por usuario.
Configuración del negocio: datos fiscales, resolución DIAN, logo, impuestos.
Permisos avanzados: marcar permisos por módulo además del rol.
Turnos: entrada/salida de vendedores y relación con apertura/cierre de caja.