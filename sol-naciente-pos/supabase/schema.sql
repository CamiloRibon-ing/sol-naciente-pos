-- =====================================================================
--  POS CENTRO RECREACIONAL  —  Esquema PostgreSQL para Supabase
--  Cubre: ventas multipunto, inventario por bodega, recetas/costos,
--  alquiler de apartamentos y espacios, acceso a piscina, caja,
--  compras, gastos, nómina, contabilidad (opcional), auditoría y
--  vistas de reportes (diario/semanal/mensual/anual + rentabilidad).
--  Normalizado a 1FN, 2FN y 3FN.
-- =====================================================================

-- ---------- EXTENSIONES ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()  (Supabase ya lo trae)

-- ---------- TIPOS / ENUMS ----------
create type tipo_producto         as enum ('comida','bebida','acceso','combo','otro');
create type tipo_mov_inventario   as enum ('entrada','salida','ajuste','traslado');
create type tipo_mov_caja         as enum ('apertura','venta','ingreso','egreso','retiro','gasto','cierre');
create type estado_caja           as enum ('abierta','cerrada');
create type estado_venta          as enum ('pendiente','pagada','anulada');
create type estado_reserva        as enum ('pendiente','confirmada','en_curso','finalizada','cancelada');
create type tipo_reserva          as enum ('apartamento','evento');
create type tipo_concepto_nomina  as enum ('devengado','deduccion');
create type estado_periodo_nomina as enum ('abierto','liquidado','pagado');

-- ---------- FUNCIÓN: updated_at automático ----------
create or replace function fn_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================================
--  1. SEGURIDAD: ROLES Y USUARIOS
-- =====================================================================
create table roles (
  id_rol       uuid primary key default gen_random_uuid(),
  nombre_rol   text not null unique,          -- Administrador, Cajero, Mesero, Barman, Cocinero, Recepción, Salvavidas
  descripcion  text
);

-- Perfil de la app ligado al usuario de autenticación de Supabase.
-- La contraseña NO se guarda aquí: la gestiona Supabase Auth (auth.users).
create table usuarios (
  id_usuario    uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null,
  correo        text not null unique,
  documento     text,
  telefono      text,
  id_rol        uuid references roles(id_rol),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_usuarios_updated before update on usuarios
  for each row execute function fn_set_updated_at();

-- =====================================================================
--  2. UBICACIONES: PUNTOS DE VENTA Y BODEGAS
-- =====================================================================
-- Bodega = lugar físico donde se controla stock (Bodega Central, Cocina, Bar, Taquilla)
create table bodegas (
  id_bodega    uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  activo       boolean not null default true
);

-- Punto de venta = caja/terminal donde se factura. Cada uno descuenta de una bodega.
create table puntos_venta (
  id_punto     uuid primary key default gen_random_uuid(),
  nombre       text not null,                 -- "Restaurante", "Bar", "Taquilla Piscina", "Recepción"
  ubicacion    text,
  id_bodega    uuid references bodegas(id_bodega),
  id_punto_padre uuid references puntos_venta(id_punto),
  activo       boolean not null default true
);

-- =====================================================================
--  3. CATÁLOGO: CATEGORÍAS, PRODUCTOS, INGREDIENTES, RECETAS
-- =====================================================================
alter table usuarios
  add column if not exists id_punto uuid references puntos_venta(id_punto);

create table categorias (
  id_categoria      uuid primary key default gen_random_uuid(),
  nombre_categoria  text not null unique,     -- Hamburguesas, Bebidas, Acceso Piscina, Combos...
  descripcion       text,
  color             text,
  activo            boolean not null default true
);

-- Producto = todo lo que aparece en el menú estilo KFC (comida, bebida, acceso piscina, combo)
create table productos (
  id_producto          uuid primary key default gen_random_uuid(),
  codigo               text unique,
  nombre               text not null,
  descripcion          text,                  -- descripción que se muestra en el menú
  id_categoria         uuid references categorias(id_categoria),
  tipo                 tipo_producto not null default 'comida',
  precio_venta         numeric(12,2) not null check (precio_venta >= 0),
  costo_estimado       numeric(12,2) not null default 0,  -- para reventa (ej. botella); las recetas calculan el costo real
  imagen_url           text,                  -- URL pública de Cloudinary
  controla_inventario  boolean not null default true,     -- comidas/bebidas con receta = true; acceso piscina = false
  stock_actual         numeric(12,3) not null default 0,   -- para productos sin receta: gaseosas, paquetes, referencias listas
  stock_minimo         numeric(12,3) not null default 0,
  activo               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_productos_updated before update on productos
  for each row execute function fn_set_updated_at();

-- Materias primas
create table ingredientes (
  id_ingrediente   uuid primary key default gen_random_uuid(),
  nombre           text not null,
  unidad_medida    text not null,             -- g, kg, ml, l, und
  costo_unitario   numeric(12,2) not null default 0,  -- último costo (se actualiza con cada compra)
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_ingredientes_updated before update on ingredientes
  for each row execute function fn_set_updated_at();

-- Stock por bodega (existencias). Un ingrediente puede estar en varias bodegas.
create table inventario (
  id_inventario   uuid primary key default gen_random_uuid(),
  id_ingrediente  uuid not null references ingredientes(id_ingrediente),
  id_bodega       uuid not null references bodegas(id_bodega),
  stock_actual    numeric(12,3) not null default 0,
  stock_minimo    numeric(12,3) not null default 0,
  updated_at      timestamptz not null default now(),
  unique (id_ingrediente, id_bodega)
);
create trigger trg_inventario_updated before update on inventario
  for each row execute function fn_set_updated_at();

-- Kardex: registro de cada entrada/salida/ajuste de inventario
create table movimientos_inventario (
  id_movimiento   uuid primary key default gen_random_uuid(),
  id_ingrediente  uuid references ingredientes(id_ingrediente),
  id_producto     uuid references productos(id_producto),
  id_bodega       uuid not null references bodegas(id_bodega),
  tipo            tipo_mov_inventario not null,
  cantidad        numeric(12,3) not null,
  costo_unitario  numeric(12,2),
  referencia      text,                        -- 'venta:<id>', 'compra:<id>', 'ajuste manual'...
  id_usuario      uuid references usuarios(id_usuario),
  fecha           timestamptz not null default now(),
  check (id_ingrediente is not null or id_producto is not null)
);

-- Receta: relaciona un producto con los ingredientes que consume
create table recetas (
  id_receta       uuid primary key default gen_random_uuid(),
  id_producto     uuid not null references productos(id_producto) on delete cascade,
  id_ingrediente  uuid not null references ingredientes(id_ingrediente),
  cantidad        numeric(12,3) not null check (cantidad > 0),
  unique (id_producto, id_ingrediente)
);

-- =====================================================================
--  4. TERCEROS: CLIENTES, PROVEEDORES, MÉTODOS DE PAGO
-- =====================================================================
create table clientes (
  id_cliente   uuid primary key default gen_random_uuid(),
  nombre       text not null,
  documento    text,
  telefono     text,
  correo       text,
  created_at   timestamptz not null default now()
);

create table proveedores (
  id_proveedor uuid primary key default gen_random_uuid(),
  nombre       text not null,
  nit          text,
  telefono     text,
  correo       text,
  activo       boolean not null default true
);

create table metodos_pago (
  id_metodo  uuid primary key default gen_random_uuid(),
  nombre     text not null unique,            -- Efectivo, Tarjeta, Transferencia, Nequi, Daviplata
  activo     boolean not null default true
);

create table configuracion_negocio (
  id                boolean primary key default true check (id),
  nombre            text not null,
  nit               text,
  direccion         text,
  telefono          text,
  correo            text,
  resolucion_dian   text,
  logo_url          text,
  prefijo_factura   text not null default 'FAC',
  impuesto_rate     numeric(8,6) not null default 0.08,
  menu_orden        jsonb not null default '[]'::jsonb,
  menu_oculto       jsonb not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);
create trigger trg_configuracion_negocio_updated before update on configuracion_negocio
  for each row execute function fn_set_updated_at();

-- =====================================================================
--  5. ALQUILERES: APARTAMENTOS Y ESPACIOS PARA EVENTOS + RESERVAS
-- =====================================================================
create table apartamentos (
  id_apartamento     uuid primary key default gen_random_uuid(),
  nombre             text not null,           -- "Apartamento 1", "Cabaña Lago"
  descripcion        text,
  capacidad          int,
  precio_dia         numeric(12,2),
  precio_fin_semana  numeric(12,2),
  imagen_url         text,
  activo             boolean not null default true
);

create table espacios_evento (
  id_espacio    uuid primary key default gen_random_uuid(),
  nombre        text not null,                -- "Salón Principal", "Kiosko 2"
  descripcion   text,
  capacidad     int,
  precio_base   numeric(12,2),
  imagen_url    text,
  activo        boolean not null default true
);

-- Una reserva ocupa un apartamento O un espacio en un rango de fechas.
-- El cobro se canaliza por la tabla ventas (línea que referencia la reserva).
create table reservas (
  id_reserva      uuid primary key default gen_random_uuid(),
  tipo            tipo_reserva not null,
  id_apartamento  uuid references apartamentos(id_apartamento),
  id_espacio      uuid references espacios_evento(id_espacio),
  id_cliente      uuid references clientes(id_cliente),
  id_usuario      uuid references usuarios(id_usuario),
  fecha_inicio    timestamptz not null,
  fecha_fin       timestamptz not null,
  num_personas    int,
  monto_total     numeric(12,2) not null default 0,
  estado          estado_reserva not null default 'pendiente',
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (fecha_fin > fecha_inicio),
  check (
    (tipo = 'apartamento' and id_apartamento is not null and id_espacio is null) or
    (tipo = 'evento'      and id_espacio    is not null and id_apartamento is null)
  )
);
create trigger trg_reservas_updated before update on reservas
  for each row execute function fn_set_updated_at();

-- =====================================================================
--  6. CAJA
-- =====================================================================
create table cajas (
  id_caja               uuid primary key default gen_random_uuid(),
  id_punto              uuid not null references puntos_venta(id_punto),
  id_usuario_apertura   uuid references usuarios(id_usuario),
  monto_inicial         numeric(12,2) not null default 0,
  fecha_apertura        timestamptz not null default now(),
  id_usuario_cierre     uuid references usuarios(id_usuario),
  monto_final_esperado  numeric(12,2),
  monto_final_real      numeric(12,2),
  diferencia            numeric(12,2),
  fecha_cierre          timestamptz,
  estado                estado_caja not null default 'abierta'
);

create table movimientos_caja (
  id_movimiento  uuid primary key default gen_random_uuid(),
  id_caja        uuid not null references cajas(id_caja),
  tipo           tipo_mov_caja not null,
  descripcion    text,
  monto          numeric(12,2) not null,
  fecha          timestamptz not null default now(),
  id_usuario     uuid references usuarios(id_usuario)
);

-- =====================================================================
--  7. VENTAS (POS)
-- =====================================================================
create table ventas (
  id_venta     uuid primary key default gen_random_uuid(),
  numero       bigint generated always as identity,   -- consecutivo legible para el comprobante
  id_punto     uuid not null references puntos_venta(id_punto),
  id_caja      uuid references cajas(id_caja),
  id_usuario   uuid references usuarios(id_usuario),   -- quién realizó la venta
  id_cliente   uuid references clientes(id_cliente),
  fecha        timestamptz not null default now(),
  subtotal     numeric(12,2) not null default 0,
  descuento    numeric(12,2) not null default 0,
  impuestos    numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  estado       estado_venta not null default 'pagada',
  tipo_documento       text not null default 'ticket',
  estado_electronico   text not null default 'no_configurado',
  cufe                 text,
  qr_texto             text,
  pdf_url              text,
  xml_url              text,
  enviado_email        boolean not null default false,
  enviado_whatsapp     boolean not null default false,
  notas        text,
  created_at   timestamptz not null default now()
);

-- Cada renglón de la venta. Puede ser un producto (comida/bebida/acceso)
-- O el cobro de una reserva (apartamento/evento).
create table detalle_venta (
  id_detalle       uuid primary key default gen_random_uuid(),
  id_venta         uuid not null references ventas(id_venta) on delete cascade,
  id_producto      uuid references productos(id_producto),
  id_reserva       uuid references reservas(id_reserva),
  descripcion      text,                       -- snapshot del nombre al momento de vender
  cantidad         numeric(12,3) not null default 1 check (cantidad > 0),
  precio_unitario  numeric(12,2) not null,
  descuento        numeric(12,2) not null default 0,
  subtotal         numeric(12,2) not null,
  check (id_producto is not null or id_reserva is not null)
);

-- Pagos: permite pago dividido (efectivo + tarjeta, etc.).
-- Puede aplicar a una venta o a una reserva (anticipo previo a la factura).
create table pagos (
  id_pago      uuid primary key default gen_random_uuid(),
  id_venta     uuid references ventas(id_venta) on delete cascade,
  id_reserva   uuid references reservas(id_reserva),
  id_metodo    uuid not null references metodos_pago(id_metodo),
  monto        numeric(12,2) not null check (monto > 0),
  referencia   text,                           -- nro de aprobación / comprobante
  fecha        timestamptz not null default now(),
  check (id_venta is not null or id_reserva is not null)
);

-- =====================================================================
--  8. COMPRAS (abastecimiento de ingredientes)
-- =====================================================================
create table compras (
  id_compra       uuid primary key default gen_random_uuid(),
  id_proveedor    uuid references proveedores(id_proveedor),
  id_bodega       uuid not null references bodegas(id_bodega),  -- a qué bodega entra la mercancía
  id_usuario      uuid references usuarios(id_usuario),
  fecha           timestamptz not null default now(),
  numero_factura  text,
  subtotal        numeric(12,2) not null default 0,
  impuestos       numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create table detalle_compra (
  id_detalle_compra uuid primary key default gen_random_uuid(),
  id_compra         uuid not null references compras(id_compra) on delete cascade,
  id_ingrediente    uuid references ingredientes(id_ingrediente),
  id_producto       uuid references productos(id_producto),
  cantidad          numeric(12,3) not null check (cantidad > 0),
  costo_unitario    numeric(12,2) not null,
  subtotal          numeric(12,2) not null,
  check (id_ingrediente is not null or id_producto is not null)
);

-- =====================================================================
--  9. GASTOS OPERATIVOS
-- =====================================================================
create table categorias_gasto (
  id_categoria_gasto uuid primary key default gen_random_uuid(),
  nombre             text not null unique     -- Arriendo, Servicios, Mantenimiento, Publicidad, Transporte
);

create table gastos (
  id_gasto            uuid primary key default gen_random_uuid(),
  id_categoria_gasto  uuid references categorias_gasto(id_categoria_gasto),
  id_punto            uuid references puntos_venta(id_punto),
  descripcion         text,
  monto               numeric(12,2) not null check (monto >= 0),
  fecha               date not null default current_date,
  id_usuario          uuid references usuarios(id_usuario),
  created_at          timestamptz not null default now()
);

-- =====================================================================
--  10. NÓMINA
-- =====================================================================
create table cargos (
  id_cargo       uuid primary key default gen_random_uuid(),
  nombre         text not null,               -- Mesero, Cocinero, Salvavidas, Recepcionista
  salario_base   numeric(12,2)
);

create table empleados (
  id_empleado    uuid primary key default gen_random_uuid(),
  id_usuario     uuid references usuarios(id_usuario),  -- nulo si no usa el sistema
  nombre         text not null,
  documento      text,
  id_cargo       uuid references cargos(id_cargo),
  salario_base   numeric(12,2),
  tipo_contrato  text,                         -- término fijo, indefinido, prestación de servicios
  fecha_ingreso  date,
  fecha_retiro   date,
  telefono       text,
  correo         text,
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table periodos_nomina (
  id_periodo     uuid primary key default gen_random_uuid(),
  nombre         text not null,               -- "Quincena 1 - Junio 2026"
  fecha_inicio   date not null,
  fecha_fin      date not null,
  tipo           text,                         -- quincenal / mensual
  estado         estado_periodo_nomina not null default 'abierto',
  created_at     timestamptz not null default now()
);

-- Conceptos reutilizables (devengados y deducciones)
create table conceptos_nomina (
  id_concepto    uuid primary key default gen_random_uuid(),
  nombre         text not null,               -- Salario, Horas extra, Auxilio transporte, Salud, Pensión, Bonificación
  tipo           tipo_concepto_nomina not null,
  es_porcentaje  boolean not null default false,
  valor_default  numeric(12,2)
);

-- Liquidación de un empleado en un periodo
create table nomina_detalle (
  id_nomina_detalle  uuid primary key default gen_random_uuid(),
  id_periodo         uuid not null references periodos_nomina(id_periodo),
  id_empleado        uuid not null references empleados(id_empleado),
  dias_trabajados    numeric(5,2),
  total_devengado    numeric(12,2) not null default 0,
  total_deducciones  numeric(12,2) not null default 0,
  neto_pagar         numeric(12,2) generated always as (total_devengado - total_deducciones) stored,
  monto_pagado       numeric(12,2) not null default 0,
  fecha_pago         date,
  unique (id_periodo, id_empleado)
);

-- Renglones de la liquidación (cada devengado/deducción)
create table nomina_conceptos (
  id                  uuid primary key default gen_random_uuid(),
  id_nomina_detalle   uuid not null references nomina_detalle(id_nomina_detalle) on delete cascade,
  id_concepto         uuid not null references conceptos_nomina(id_concepto),
  valor               numeric(12,2) not null
);

-- =====================================================================
--  11. CONTABILIDAD (MÓDULO OPCIONAL - partida doble)
--  Úsalo cuando quieras llevar contabilidad formal. Las vistas de
--  reportes ya te dan ingresos/costos/utilidad sin necesidad de esto.
-- =====================================================================
create table plan_cuentas (
  id_cuenta    uuid primary key default gen_random_uuid(),
  codigo       text not null unique,          -- 1105, 4135, 5135...
  nombre       text not null,
  tipo         text not null,                 -- activo, pasivo, patrimonio, ingreso, gasto, costo
  naturaleza   text not null                  -- debito / credito
);

create table asientos_contables (
  id_asiento   uuid primary key default gen_random_uuid(),
  fecha        date not null default current_date,
  descripcion  text,
  referencia   text,                          -- 'venta:<id>', 'compra:<id>'...
  id_usuario   uuid references usuarios(id_usuario),
  created_at   timestamptz not null default now()
);

create table movimientos_contables (
  id_mov       uuid primary key default gen_random_uuid(),
  id_asiento   uuid not null references asientos_contables(id_asiento) on delete cascade,
  id_cuenta    uuid not null references plan_cuentas(id_cuenta),
  debito       numeric(14,2) not null default 0,
  credito      numeric(14,2) not null default 0
);

-- =====================================================================
--  12. AUDITORÍA
-- =====================================================================
create table auditoria (
  id_auditoria    uuid primary key default gen_random_uuid(),
  id_usuario      uuid references usuarios(id_usuario),
  accion          text,                        -- INSERT / UPDATE / DELETE / LOGIN
  tabla_afectada  text,
  registro_id     text,
  detalle         jsonb,
  fecha           timestamptz not null default now()
);
create index idx_auditoria_fecha on auditoria (fecha desc);
create index idx_auditoria_usuario on auditoria (id_usuario);
create index idx_auditoria_accion on auditoria (accion);
create index idx_auditoria_tabla on auditoria (tabla_afectada);

-- =====================================================================
--  13. AUTOMATIZACIÓN: TRIGGERS DE INVENTARIO
-- =====================================================================

-- Al vender un producto con receta -> descuenta ingredientes de la bodega del punto de venta
create or replace function fn_consumo_inventario()
returns trigger as $$
declare
  v_bodega uuid;
  v_controla boolean;
  v_recetas integer;
  r record;
begin
  if new.id_producto is null then
    return new;
  end if;

  select controla_inventario into v_controla from productos where id_producto = new.id_producto;
  if not coalesce(v_controla, false) then
    return new;
  end if;

  select pv.id_bodega into v_bodega
  from ventas v
  join puntos_venta pv on pv.id_punto = v.id_punto
  where v.id_venta = new.id_venta;

  if v_bodega is null then
    return new;
  end if;

  select count(*) into v_recetas from recetas where id_producto = new.id_producto;
  if coalesce(v_recetas, 0) = 0 then
    update productos
      set stock_actual = greatest(0, stock_actual - new.cantidad)
      where id_producto = new.id_producto;

    insert into movimientos_inventario (id_producto, id_bodega, tipo, cantidad, referencia)
      values (new.id_producto, v_bodega, 'salida', new.cantidad, 'venta:' || new.id_venta);

    return new;
  end if;

  for r in select id_ingrediente, cantidad from recetas where id_producto = new.id_producto loop
    update inventario
      set stock_actual = stock_actual - (r.cantidad * new.cantidad)
      where id_ingrediente = r.id_ingrediente and id_bodega = v_bodega;

    insert into movimientos_inventario (id_ingrediente, id_bodega, tipo, cantidad, referencia)
      values (r.id_ingrediente, v_bodega, 'salida', r.cantidad * new.cantidad, 'venta:' || new.id_venta);
  end loop;

  return new;
end;
$$ language plpgsql;

create trigger trg_consumo_inventario
  after insert on detalle_venta
  for each row execute function fn_consumo_inventario();

-- Al registrar una compra -> aumenta stock en la bodega y actualiza el costo del ingrediente
create or replace function fn_entrada_inventario()
returns trigger as $$
declare
  v_bodega uuid;
begin
  select id_bodega into v_bodega from compras where id_compra = new.id_compra;

  if new.id_producto is not null then
    update productos
      set stock_actual = stock_actual + new.cantidad,
          costo_estimado = new.costo_unitario
      where id_producto = new.id_producto;

    insert into movimientos_inventario (id_producto, id_bodega, tipo, cantidad, costo_unitario, referencia)
      values (new.id_producto, v_bodega, 'entrada', new.cantidad, new.costo_unitario, 'compra:' || new.id_compra);

    return new;
  end if;

  if new.id_ingrediente is null then
    return new;
  end if;

  insert into inventario (id_ingrediente, id_bodega, stock_actual)
    values (new.id_ingrediente, v_bodega, new.cantidad)
  on conflict (id_ingrediente, id_bodega)
    do update set stock_actual = inventario.stock_actual + excluded.stock_actual;

  insert into movimientos_inventario (id_ingrediente, id_bodega, tipo, cantidad, costo_unitario, referencia)
    values (new.id_ingrediente, v_bodega, 'entrada', new.cantidad, new.costo_unitario, 'compra:' || new.id_compra);

  update ingredientes set costo_unitario = new.costo_unitario where id_ingrediente = new.id_ingrediente;

  return new;
end;
$$ language plpgsql;

create trigger trg_entrada_inventario
  after insert on detalle_compra
  for each row execute function fn_entrada_inventario();

-- =====================================================================
--  14. VISTAS DE REPORTES (contabilidad, rentabilidad, gráficas)
-- =====================================================================

-- Costo, utilidad y margen por producto (recetas o costo estimado)
create or replace view vista_rentabilidad_producto as
select
  p.id_producto,
  p.nombre,
  p.precio_venta,
  coalesce(
    (select sum(r.cantidad * i.costo_unitario)
       from recetas r
       join ingredientes i on i.id_ingrediente = r.id_ingrediente
      where r.id_producto = p.id_producto),
    p.costo_estimado
  ) as costo,
  p.precio_venta - coalesce(
    (select sum(r.cantidad * i.costo_unitario)
       from recetas r
       join ingredientes i on i.id_ingrediente = r.id_ingrediente
      where r.id_producto = p.id_producto),
    p.costo_estimado
  ) as utilidad,
  case when p.precio_venta > 0 then
    round(100 * (p.precio_venta - coalesce(
      (select sum(r.cantidad * i.costo_unitario)
         from recetas r
         join ingredientes i on i.id_ingrediente = r.id_ingrediente
        where r.id_producto = p.id_producto), p.costo_estimado)) / p.precio_venta, 2)
  else 0 end as margen_pct
from productos p;

-- Backbone de analítica: cada renglón vendido con su categoría, costo y utilidad
create or replace view vista_ventas_detalle as
select
  dv.id_detalle,
  v.id_venta,
  v.numero,
  v.fecha,
  v.id_punto,
  pv.nombre as punto_venta,
  dv.id_producto,
  p.nombre  as producto,
  c.nombre_categoria,
  dv.cantidad,
  dv.precio_unitario,
  dv.subtotal,
  coalesce(rp.costo, 0) as costo_unitario,
  dv.subtotal - (coalesce(rp.costo, 0) * dv.cantidad) as utilidad_linea
from detalle_venta dv
join ventas v        on v.id_venta = dv.id_venta and v.estado = 'pagada'
join puntos_venta pv on pv.id_punto = v.id_punto
left join productos p on p.id_producto = dv.id_producto
left join categorias c on c.id_categoria = p.id_categoria
left join vista_rentabilidad_producto rp on rp.id_producto = dv.id_producto;

-- Ventas agrupadas por día (la app puede reagrupar por semana/mes/año con date_trunc)
create or replace view vista_ventas_diarias as
select
  date_trunc('day', fecha)::date as dia,
  id_punto,
  count(*)        as num_ventas,
  sum(total)      as total_ventas
from ventas
where estado = 'pagada'
group by 1, 2;

-- Ventas por punto de venta (acumulado)
create or replace view vista_ventas_por_punto as
select
  pv.id_punto,
  pv.nombre,
  count(v.id_venta) as num_ventas,
  coalesce(sum(v.total), 0) as total_ventas
from puntos_venta pv
left join ventas v on v.id_punto = pv.id_punto and v.estado = 'pagada'
group by pv.id_punto, pv.nombre;

-- Inventario crítico (igual o por debajo del mínimo)
create or replace view vista_inventario_critico as
select
  i.id_ingrediente,
  ing.nombre,
  b.nombre as bodega,
  i.stock_actual,
  i.stock_minimo,
  ing.unidad_medida
from inventario i
join ingredientes ing on ing.id_ingrediente = i.id_ingrediente
join bodegas b on b.id_bodega = i.id_bodega
where i.stock_actual <= i.stock_minimo;

-- Estado de resultados mensual (ingresos, costo de ventas, gastos, nómina, utilidad)
create or replace view vista_estado_resultados_mensual as
with ventas_mes as (
  select date_trunc('month', fecha)::date as mes, sum(total) as ingresos
  from ventas where estado = 'pagada' group by 1
),
costo_mes as (
  select date_trunc('month', v.fecha)::date as mes,
         sum(dv.cantidad * coalesce(rp.costo, 0)) as costo_ventas
  from detalle_venta dv
  join ventas v on v.id_venta = dv.id_venta and v.estado = 'pagada'
  left join vista_rentabilidad_producto rp on rp.id_producto = dv.id_producto
  group by 1
),
gastos_mes as (
  select date_trunc('month', fecha)::date as mes, sum(monto) as gastos
  from gastos group by 1
),
nomina_mes as (
  select date_trunc('month', p.fecha_fin)::date as mes, sum(nd.neto_pagar) as nomina
  from nomina_detalle nd
  join periodos_nomina p on p.id_periodo = nd.id_periodo
  group by 1
)
select
  m.mes,
  coalesce(v.ingresos, 0)                                                  as ingresos,
  coalesce(c.costo_ventas, 0)                                              as costo_ventas,
  coalesce(v.ingresos, 0) - coalesce(c.costo_ventas, 0)                    as utilidad_bruta,
  coalesce(g.gastos, 0)                                                    as gastos_operativos,
  coalesce(n.nomina, 0)                                                    as nomina,
  coalesce(v.ingresos, 0) - coalesce(c.costo_ventas, 0)
      - coalesce(g.gastos, 0) - coalesce(n.nomina, 0)                      as utilidad_neta
from (
  select mes from ventas_mes
  union select mes from costo_mes
  union select mes from gastos_mes
  union select mes from nomina_mes
) m
left join ventas_mes v on v.mes = m.mes
left join costo_mes  c on c.mes = m.mes
left join gastos_mes g on g.mes = m.mes
left join nomina_mes n on n.mes = m.mes
order by m.mes;

-- =====================================================================
--  15. ÍNDICES RECOMENDADOS (consultas frecuentes y reportes)
-- =====================================================================
create index idx_ventas_fecha          on ventas (fecha);
create index idx_ventas_punto          on ventas (id_punto);
create index idx_ventas_estado         on ventas (estado);
create index idx_detalle_venta_venta   on detalle_venta (id_venta);
create index idx_detalle_venta_prod    on detalle_venta (id_producto);
create index idx_pagos_venta           on pagos (id_venta);
create index idx_mov_inv_ingrediente   on movimientos_inventario (id_ingrediente, fecha);
create index idx_reservas_fechas       on reservas (fecha_inicio, fecha_fin);
create index idx_gastos_fecha          on gastos (fecha);
create index idx_productos_categoria   on productos (id_categoria);

-- =====================================================================
--  16. SEGURIDAD A NIVEL DE FILA (RLS) — PLANTILLA
--  Supabase recomienda activar RLS en TODAS las tablas. Aquí va el
--  patrón base (usuarios autenticados). Antes de producción debes
--  definir políticas por rol (ej. cajero no edita productos).
-- =====================================================================
-- alter table productos enable row level security;
-- create policy "lectura autenticados" on productos
--   for select to authenticated using (true);
-- create policy "escritura admin" on productos
--   for all to authenticated
--   using  (exists (select 1 from usuarios u join roles r on r.id_rol = u.id_rol
--                   where u.id_usuario = auth.uid() and r.nombre_rol = 'Administrador'))
--   with check (true);

-- =====================================================================
--  FIN DEL ESQUEMA
-- =====================================================================
