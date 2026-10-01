-- ThermoGeneva — 007: confine del Canton de Genève (swisstopo swissBOUNDARIES3D, dato aperto © swisstopo)
-- Caricato dall'ETL (etl/fetch.py → fetch_canton). Usato dal sito per la maschera "fuori Ginevra"
-- e per limitare lo spostamento della mappa.

create table if not exists core.canton_boundary (
    canton_code text primary key,              -- 'GE'
    name        text not null,
    geom        extensions.geometry(MultiPolygon, 2056) not null,
    updated_at  timestamptz not null default now()
);
alter table core.canton_boundary enable row level security;
grant select on core.canton_boundary to anon, authenticated;
create policy "lettura pubblica" on core.canton_boundary for select to anon, authenticated using (true);

-- GeoJSON semplificato (≈ 5 m) in WGS84 + riquadro per i limiti della mappa
create or replace view public.canton with (security_invoker = on) as
select c.canton_code,
       c.name,
       extensions.ST_AsGeoJSON(extensions.ST_Transform(
           extensions.ST_SimplifyPreserveTopology(c.geom, 5), 4326), 5)::jsonb as geometry,
       jsonb_build_array(
           extensions.ST_XMin(extensions.ST_Transform(c.geom, 4326)),
           extensions.ST_YMin(extensions.ST_Transform(c.geom, 4326)),
           extensions.ST_XMax(extensions.ST_Transform(c.geom, 4326)),
           extensions.ST_YMax(extensions.ST_Transform(c.geom, 4326))) as bbox
from core.canton_boundary c;

grant select on public.canton to anon, authenticated;
