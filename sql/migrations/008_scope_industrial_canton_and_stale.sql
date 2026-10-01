-- ThermoGeneva — 008: perimetro allargato + dati non aggiornati
-- Perimetro del sito: tutti gli edifici nelle zone industriali FTI
--                     + tutti gli edifici "industria" e "logistica" del cantone (anche fuori dalle zone FTI).
-- Dato non aggiornato: ultima dichiarazione IDC più vecchia di 6 anni (oggi: prima del 2020).
--   Questi edifici restano visibili ma sono esclusi da statistiche e mediane del sito.

create or replace function analytics.in_site_scope(p_zone_id integer, p_family text)
returns boolean language sql immutable set search_path = '' as $$
  select p_zone_id is not null or p_family in ('industria', 'logistica')
$$;

create or replace function analytics.stale_before_year()
returns integer language sql stable set search_path = '' as $$
  select extract(year from now())::int - 6
$$;

grant execute on function analytics.in_site_scope(integer, text), analytics.stale_before_year() to anon, authenticated;

create or replace view public.buildings_latest with (security_invoker = on) as
select bb.egid, b.address, b.postal_code, b.commune, b.destination, bb.family,
       bb.zone_id, bb.year, bb.idc, bb.idc_avg_3y, bb.sre, bb.final_energy_mwh, bb.energy_source,
       bb.peer_n, bb.peer_median, bb.peer_p25, bb.peer_p75, bb.delta_vs_peer, bb.delta_vs_peer_pct,
       bb.peer_percentile, bb.zone_n, bb.zone_median, bb.delta_vs_zone_pct, bb.zone_percentile,
       bb.idc_3y_ago, bb.trend_3y_pct,
       bb.above_450, bb.above_significant_until_2026, bb.above_significant_from_2027,
       (bb.year < analytics.stale_before_year()) as is_stale
from analytics.building_benchmark bb
join core.buildings b using (egid)
where bb.is_latest and analytics.in_site_scope(bb.zone_id, bb.family);

create or replace view public.building_history with (security_invoker = on) as
select bb.egid, bb.year, bb.idc, bb.idc_avg_3y, bb.peer_median, bb.zone_median, bb.energy_source
from analytics.building_benchmark bb
where analytics.in_site_scope(bb.zone_id, bb.family);

create or replace function public.map_geojson()
returns jsonb
language sql stable security invoker set search_path = '' as $$
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
