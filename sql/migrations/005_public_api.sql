-- ThermoGeneva — 005: livello pubblico in sola lettura per il sito
-- Il sito legge SOLO queste viste/funzioni nello schema public (esposto dall'API di Supabase).
-- Scope del prodotto: edifici assegnati a una zona industriale FTI.
-- I benchmark restano calcolati su tutto il cantone (analytics.building_benchmark).

-- Permessi di lettura minimi per il ruolo pubblico (anon) sugli oggetti sottostanti
grant usage on schema analytics, core to anon, authenticated;
grant select on analytics.building_benchmark, analytics.zone_metrics to anon, authenticated;
grant select on core.buildings, core.industrial_zones, core.building_zone, core.destination_family
  to anon, authenticated;

create policy "lettura pubblica" on core.buildings          for select to anon, authenticated using (true);
create policy "lettura pubblica" on core.industrial_zones   for select to anon, authenticated using (true);
create policy "lettura pubblica" on core.building_zone      for select to anon, authenticated using (true);
create policy "lettura pubblica" on core.destination_family for select to anon, authenticated using (true);

-- Comune prevalente di ogni zona (il layer FTI non ha nomi)
create or replace view public.zones with (security_invoker = on) as
select z.zone_id,
       z.zone_type,
       z.zone_name,
       coalesce(z.slug, z.zone_id::text) as slug,
       z.surface_m2,
       (select b.commune from core.building_zone bz join core.buildings b using (egid)
         where bz.zone_id = z.zone_id group by b.commune order by count(*) desc, b.commune limit 1) as commune,
       (select count(*) from core.building_zone bz where bz.zone_id = z.zone_id) as buildings_total
from core.industrial_zones z;

-- Ultimo anno disponibile per ogni edificio delle zone industriali
create or replace view public.buildings_latest with (security_invoker = on) as
select bb.egid, b.address, b.postal_code, b.commune, b.destination, bb.family,
       bb.zone_id, bb.year, bb.idc, bb.idc_avg_3y, bb.sre, bb.final_energy_mwh, bb.energy_source,
       bb.peer_n, bb.peer_median, bb.peer_p25, bb.peer_p75, bb.delta_vs_peer, bb.delta_vs_peer_pct,
       bb.peer_percentile, bb.zone_n, bb.zone_median, bb.delta_vs_zone_pct, bb.zone_percentile,
       bb.idc_3y_ago, bb.trend_3y_pct,
       bb.above_450, bb.above_significant_until_2026, bb.above_significant_from_2027
from analytics.building_benchmark bb
join core.buildings b using (egid)
where bb.is_latest and bb.zone_id is not null;

-- Storico per i grafici della pagina edificio
create or replace view public.building_history with (security_invoker = on) as
select bb.egid, bb.year, bb.idc, bb.idc_avg_3y, bb.peer_median, bb.zone_median, bb.energy_source
from analytics.building_benchmark bb
where bb.zone_id is not null;

-- Metriche di zona per anno
create or replace view public.zone_metrics with (security_invoker = on) as
select zm.zone_id, zm.zone_type, zm.year, zm.buildings, zm.median_idc, zm.p25_idc, zm.p75_idc,
       zm.total_sre_m2, zm.total_final_energy_mwh, zm.buildings_above_450, zm.buildings_above_650,
       zm.share_above_peer_median_pct, zm.zone_benchmark_valid
from analytics.zone_metrics zm;

-- GeoJSON per la mappa (WGS84): zone + edifici delle zone con le metriche per colorarli
create or replace function public.map_geojson()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'zones', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', z.zone_id,
        'geometry', extensions.ST_AsGeoJSON(extensions.ST_Transform(
                      extensions.ST_SimplifyPreserveTopology(z.geom, 1), 4326), 6)::jsonb,
        'properties', jsonb_build_object('zone_id', z.zone_id, 'zone_type', z.zone_type, 'zone_name', z.zone_name)))
      from core.industrial_zones z), '[]'::jsonb)),
    'buildings', jsonb_build_object('type', 'FeatureCollection', 'features', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', b.egid,
        'geometry', extensions.ST_AsGeoJSON(extensions.ST_Transform(
                      extensions.ST_SimplifyPreserveTopology(b.geom, 0.3), 4326), 6)::jsonb,
        'properties', jsonb_build_object(
            'egid', b.egid, 'address', b.address, 'zone_id', bl.zone_id, 'family', bl.family,
            'year', bl.year, 'idc', bl.idc, 'peer_percentile', bl.peer_percentile,
            'delta_vs_peer_pct', bl.delta_vs_peer_pct, 'peer_median', bl.peer_median,
            'final_energy_mwh', bl.final_energy_mwh, 'energy_source', bl.energy_source,
            'sre', bl.sre, 'above_450', bl.above_450)))
      from public.buildings_latest bl join core.buildings b using (egid)), '[]'::jsonb)),
    'generated_at', now()
  );
$$;

grant select on public.zones, public.buildings_latest, public.building_history, public.zone_metrics
  to anon, authenticated;
grant execute on function public.map_geojson() to anon, authenticated;

-- Data dell'ultimo aggiornamento riuscito (da mostrare sul sito)
create or replace view public.data_freshness with (security_invoker = on) as
select max(finished_at) as last_refresh from core.etl_runs where status = 'success';
grant select (status, finished_at) on core.etl_runs to anon, authenticated;
create policy "lettura pubblica esiti" on core.etl_runs for select to anon, authenticated using (status = 'success');
grant select on public.data_freshness to anon, authenticated;

-- Sicurezza: search_path fisso (lint Supabase)
alter function analytics.min_peers() set search_path = '';
