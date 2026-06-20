-- Datos base reales para Supabase.
-- Ejecutar en Supabase SQL Editor despues de aplicar schema.sql.

insert into roles (nombre_rol, descripcion)
select 'admin', 'Acceso total al sistema'
where not exists (select 1 from roles where lower(nombre_rol) = 'admin');

insert into roles (nombre_rol, descripcion)
select 'supervisor', 'Supervision de ventas, caja y reportes'
where not exists (select 1 from roles where lower(nombre_rol) = 'supervisor');

insert into roles (nombre_rol, descripcion)
select 'cajero', 'Vendedor con acceso a POS, caja y clientes'
where not exists (select 1 from roles where lower(nombre_rol) = 'cajero');

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'puntos_venta'
      and column_name = 'id_punto_padre'
  ) then
    alter table public.puntos_venta add column id_punto_padre uuid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'puntos_venta_id_punto_padre_fkey'
  ) then
    alter table public.puntos_venta
      add constraint puntos_venta_id_punto_padre_fkey
      foreign key (id_punto_padre) references public.puntos_venta(id_punto);
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'id_punto'
  ) then
    alter table public.usuarios add column id_punto uuid;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'documento'
  ) then
    alter table public.usuarios add column documento text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'telefono'
  ) then
    alter table public.usuarios add column telefono text;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_id_punto_fkey'
  ) then
    alter table public.usuarios
      add constraint usuarios_id_punto_fkey
      foreign key (id_punto) references public.puntos_venta(id_punto);
  end if;
end $$;

do $$
declare
  v_punto_principal constant uuid := '133c2615-8213-4e2b-8a8d-1d6ec31499fb';
  v_bodega constant uuid := '10c1b4ae-0dcc-430e-9d65-35e334dcbbdb';
begin
  insert into public.bodegas (id_bodega, nombre, descripcion, activo)
  select v_bodega, 'Bodega principal', 'Bodega base del Centro Recreacional Sol Naciente', true
  where not exists (
    select 1 from public.bodegas where id_bodega = v_bodega
  );

  insert into public.puntos_venta (id_punto, nombre, ubicacion, id_bodega, activo, id_punto_padre)
  values (v_punto_principal, 'Punto de venta principal', 'Centro recreacional', v_bodega, true, null)
  on conflict (id_punto) do update
     set nombre = excluded.nombre,
         ubicacion = excluded.ubicacion,
         id_bodega = excluded.id_bodega,
         activo = true,
         id_punto_padre = null;

  update public.puntos_venta
     set activo = false,
         id_punto_padre = v_punto_principal
   where lower(nombre) = 'punto principal'
     and id_punto <> v_punto_principal;

  insert into public.puntos_venta (nombre, ubicacion, id_bodega, id_punto_padre, activo)
  select 'Kiosco piscina', 'Zona de piscinas', v_bodega, v_punto_principal, true
  where not exists (
    select 1 from public.puntos_venta where lower(nombre) = 'kiosco piscina'
  );

  insert into public.puntos_venta (nombre, ubicacion, id_bodega, id_punto_padre, activo)
  select 'Kiosco micheladas', 'Zona de bebidas', v_bodega, v_punto_principal, true
  where not exists (
    select 1 from public.puntos_venta where lower(nombre) = 'kiosco micheladas'
  );

  update public.puntos_venta
     set id_punto_padre = null
   where id_punto = v_punto_principal;

  update public.puntos_venta
     set id_punto_padre = v_punto_principal,
         id_bodega = coalesce(id_bodega, v_bodega)
   where lower(nombre) in ('kiosco piscina', 'kiosco micheladas');
end $$;

insert into metodos_pago (nombre, activo)
select metodo, true
from (values
  ('Efectivo'),
  ('Tarjeta'),
  ('Transferencia'),
  ('Nequi'),
  ('Daviplata')
) as m(metodo)
where not exists (
  select 1 from metodos_pago mp where lower(mp.nombre) = lower(m.metodo)
);

alter table public.categorias
  add column if not exists color text;

alter table public.categorias
  add column if not exists activo boolean not null default true;

alter table public.ventas
  add column if not exists tipo_documento text not null default 'ticket';

alter table public.ventas
  add column if not exists estado_electronico text not null default 'no_configurado';

alter table public.ventas
  add column if not exists cufe text;

alter table public.ventas
  add column if not exists qr_texto text;

alter table public.ventas
  add column if not exists pdf_url text;

alter table public.ventas
  add column if not exists xml_url text;

alter table public.ventas
  add column if not exists enviado_email boolean not null default false;

alter table public.ventas
  add column if not exists enviado_whatsapp boolean not null default false;

insert into public.categorias (nombre_categoria, descripcion, color, activo)
select nombre, descripcion, color, true
from (values
  ('Comidas', 'Platos preparados y menu principal', '#E22B23'),
  ('Bebidas', 'Bebidas frias y calientes', '#F58220'),
  ('Acceso piscina', 'Entradas y pasadias de piscina', '#1A4FA0'),
  ('Alojamiento', 'Apartamentos y cabanas', '#FBB814'),
  ('Eventos', 'Servicios y espacios para eventos', '#B71F18')
) as c(nombre, descripcion, color)
where not exists (
  select 1 from public.categorias cat where lower(cat.nombre_categoria) = lower(c.nombre)
);

update public.categorias set color = '#E22B23' where lower(nombre_categoria) = 'comidas' and color is null;
update public.categorias set color = '#F58220' where lower(nombre_categoria) = 'bebidas' and color is null;
update public.categorias set color = '#1A4FA0' where lower(nombre_categoria) = 'acceso piscina' and color is null;
update public.categorias set color = '#FBB814' where lower(nombre_categoria) = 'alojamiento' and color is null;
update public.categorias set color = '#B71F18' where lower(nombre_categoria) = 'eventos' and color is null;

create table if not exists public.configuracion_negocio (
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

alter table public.configuracion_negocio
  add column if not exists menu_orden jsonb not null default '[]'::jsonb;

alter table public.configuracion_negocio
  add column if not exists menu_oculto jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_configuracion_negocio_updated'
  ) then
    create trigger trg_configuracion_negocio_updated before update on public.configuracion_negocio
      for each row execute function public.fn_set_updated_at();
  end if;
end $$;

insert into public.configuracion_negocio (
  id, nombre, nit, direccion, telefono, correo, resolucion_dian, logo_url, prefijo_factura, impuesto_rate, menu_orden, menu_oculto
)
values (
  true,
  'Centro Recreacional Sol Naciente',
  '900.000.000-0',
  'Km 5 via al recreo, Colombia',
  '(60X) 000 0000',
  'ventas@solnaciente.co',
  'Resolucion de facturacion DIAN: pendiente de asignacion',
  null,
  'FAC',
  0.08,
  '[]'::jsonb,
  '[]'::jsonb
)
on conflict (id) do nothing;

create index if not exists idx_auditoria_fecha on public.auditoria (fecha desc);
create index if not exists idx_auditoria_usuario on public.auditoria (id_usuario);
create index if not exists idx_auditoria_accion on public.auditoria (accion);
create index if not exists idx_auditoria_tabla on public.auditoria (tabla_afectada);

insert into public.apartamentos (nombre, descripcion, capacidad, precio_dia, precio_fin_semana, activo)
select 'Apartamento familiar', 'Apartamento para hospedaje familiar', 5, 180000, 420000, true
where not exists (
  select 1 from public.apartamentos where lower(nombre) = 'apartamento familiar'
);

insert into public.apartamentos (nombre, descripcion, capacidad, precio_dia, precio_fin_semana, activo)
select 'Cabana lago', 'Cabana para fin de semana y descanso', 6, 220000, 520000, true
where not exists (
  select 1 from public.apartamentos where lower(nombre) = 'cabana lago'
);

insert into public.espacios_evento (nombre, descripcion, capacidad, precio_base, activo)
select 'Salon principal', 'Salon para eventos y reuniones', 120, 800000, true
where not exists (
  select 1 from public.espacios_evento where lower(nombre) = 'salon principal'
);

insert into public.espacios_evento (nombre, descripcion, capacidad, precio_base, activo)
select 'Kiosko familiar', 'Kiosko para celebraciones y reuniones pequenas', 30, 120000, true
where not exists (
  select 1 from public.espacios_evento where lower(nombre) = 'kiosko familiar'
);
