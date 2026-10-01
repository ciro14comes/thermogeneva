-- ThermoGeneva — 010: prestazioni
-- 1) Il filtro del perimetro è scritto direttamente nelle viste: la funzione analytics.in_site_scope()
--    (con search_path fissato) non può essere "inlined" e veniva chiamata su ~21'000 righe.
-- 2) La mappa (GeoJSON, ~0,8 s di calcolo) viene preparata una volta a ogni refresh dei dati
--    e salvata in analytics.map_cache: public.map_geojson() la legge in pochi millisecondi.
-- Motivo: durante il build Vercel genera >100 pagine in parallelo e il ruolo anon ha un timeout di 3 s.

create or replace view public.buildings_latest with (security_invoker = on) as
select bb.egid, b.address, b.postal_code, b.commune, b.destination, bb.family,
       bb.zone_id, bb.year, bb.idc, bb.idc_avg_3y, bb.sre, bb.final_energy_mwh, bb.energy_source,
       bb.peer_n, bb.peer_median, bb.peer_p25, bb.peer_p75, bb.delta_vs_peer, bb.delta_vs_peer_pct,
       bb.peer_percentile, bb.zone_n, bb.zone_median, bb.delta_vs_zone_pct, bb.zone_percentile,
       bb.idc_3y_ago, bb.trend_3y_pct,
       bb.above_450, bb.above_significant_until_2026, bb.above_significant_from_2027,
       (bb.year < extract(year from now())::int - 6) as is_stale   -- = analytics.stale_before_year()
from analytics.building_benchmark bb
join core.buildings b using (egid)
where bb.is_latest
  and (bb.zone_id is not null or bb.family in ('industria', 'logistica'));   -- = analytics.in_site_scope()

create or replace view public.building_history with (security_invoker = on) as
select bb.egid, bb.year, bb.idc, bb.idc_avg_3y, bb.peer_median, bb.zone_median, bb.energy_source
from analytics.building_benchmark bb
where bb.zone_id is not null or bb.family in ('industria', 'logistica');

-- Cache della mappa
create table if not exists analytics.map_cache (
    id            smallint primary key default 1 check (id = 1),
    payload       jsonb not null,
    generated_at  timestamptz not null default now()
);
alter table analytics.map_cache enable row level security;
create policy "lettura pubblica" on analytics.map_cache for select to anon, authenticated using (true);
grant select on analytics.map_cache to anon, authenticated;

-- Calcolo vero e proprio (stesso contenuto della vecchia public.map_geojson)
create or replace function analytics.build_map_geojson()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'zones', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', z.zone_id,
        'geometry', extensions.ST_AsGeoJSON(extensions.ST_Transform(
                      extensions.ST_SimplifyPreserveTopology(z.geom, 1), 4326), 6)::jsonb,
        'properties', jsonb_build_object('zone_id', z.zone_id, 'zone_type', z.zone_type,
                                         'zone_name', z.zone_name, 'slug', pz.slug, 'commune', pz.commune)))
      from core.industrial_zones z join public.zones pz using (zone_id)), '[]'::jsonb)),
    'buildings', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', b.egid,
        'geometry', extensions.ST_AsGeoJSON(extensions.ST_Transform(
                      extensions.ST_SimplifyPreserveTopology(b.geom, 0.3), 4326), 6)::jsonb,
        'properties', jsonb_build_object(
            'egid', b.egid, 'address', b.address, 'commune', bl.commune, 'zone_id', bl.zone_id, 'family', bl.family,
            'year', bl.year, 'idc', bl.idc, 'idc_avg_3y', bl.idc_avg_3y, 'peer_percentile', bl.peer_percentile,
            'delta_vs_peer_pct', bl.delta_vs_peer_pct, 'peer_median', bl.peer_median,
            'final_energy_mwh', bl.final_energy_mwh, 'energy_source', bl.energy_source,
            'sre', bl.sre, 'above_450', bl.above_450, 'trend_3y_pct', bl.trend_3y_pct,
            'is_stale', bl.is_stale)))
      from public.buildings_latest bl join core.buildings b using (egid)), '[]'::jsonb)),
    'generated_at', now()
  );
$$;

-- L'API pubblica legge la cache (fallback: calcolo al volo se la cache è vuota)
create or replace function public.map_geojson()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce((select payload from analytics.map_cache where id = 1),
                  analytics.build_map_geojson());
$$;
-- fallback: build_map_geojson è security definer e restituisce solo dati già pubblici
grant execute on function analytics.build_map_geojson() to anon, authenticated;

-- Refresh: viste materializzate + cache della mappa
create or replace function analytics.refresh_all()
returns void
language plpgsql security definer set search_path = '' as $$
begin
    if (select ispopulated from pg_matviews where schemaname = 'analytics' and matviewname = 'building_benchmark') then
        refresh materialized view concurrently analytics.building_benchmark;
        refresh materialized view concurrently analytics.zone_metrics;
    else
        refresh materialized view analytics.building_benchmark;
        refresh materialized view analytics.zone_metrics;
    end if;
    insert into analytics.map_cache (id, payload, generated_at)
    values (1, analytics.build_map_geojson(), now())
    on conflict (id) do update set payload = excluded.payload, generated_at = excluded.generated_at;
end $$;

select analytics.refresh_all();
