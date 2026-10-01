-- ThermoGeneva — 006: map_geojson con comune/slug delle zone e media 3 anni/trend degli edifici
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
            'egid', b.egid, 'address', b.address, 'zone_id', bl.zone_id, 'family', bl.family,
            'year', bl.year, 'idc', bl.idc, 'idc_avg_3y', bl.idc_avg_3y, 'peer_percentile', bl.peer_percentile,
            'delta_vs_peer_pct', bl.delta_vs_peer_pct, 'peer_median', bl.peer_median,
            'final_energy_mwh', bl.final_energy_mwh, 'energy_source', bl.energy_source,
            'sre', bl.sre, 'above_450', bl.above_450, 'trend_3y_pct', bl.trend_3y_pct)))
      from public.buildings_latest bl join core.buildings b using (egid)), '[]'::jsonb)),
    'generated_at', now()
  );
$$;
