-- ThermoGeneva — 004: benchmark (analytics)
-- Regole decise:
--   * peer group principale = stessa famiglia di edifici, tutto il cantone, stesso anno (min 10 edifici)
--   * mediana di zona mostrata solo se la zona ha >= 10 edifici in quell'anno
--   * energia finale stimata = IDC × SRE / 3600 (MWh/anno, normalizzata al clima, riscaldamento + ACS).
--     Per le pompe di calore è elettricità, per il teleriscaldamento calore fornito (direttiva OCEN).
--     Non è il consumo totale dell'edificio né l'energia di processo.
--   * soglie legali (règlement énergie GE, media IDC 3 anni): 450 MJ/m² = obbligo di misure;
--     superamento significativo: 800 (fino al 2026), 650 (2027-2030), 550 (dal 2031). Indicativo, non decisione ufficiale.
-- Nota tecnica: PERCENTILE_CONT non può essere una window function in PostgreSQL,
-- quindi le mediane si calcolano con GROUP BY e poi si uniscono agli edifici.

create or replace function analytics.min_peers() returns int
language sql immutable as $$ select 10 $$;

create materialized view analytics.building_benchmark as
with base as (
    select e.egid, e.year, e.idc, e.sre,
           coalesce(f.family, 'altro')                         as family,
           bz.zone_id,
           case when e.sre is not null then round((e.idc * e.sre / 3600.0)::numeric, 1) end as final_energy_mwh,
           e.idc_avg_3y,
           e.energy_source_1                                   as energy_source
    from core.energy_idc e
    join core.buildings b       using (egid)
    left join core.destination_family f on f.destination = b.destination
    left join core.building_zone bz     using (egid)
    where e.idc is not null
),
peer as (
    select family, year, count(*) as n,
           percentile_cont(0.5)  within group (order by idc) as median,
           percentile_cont(0.25) within group (order by idc) as p25,
           percentile_cont(0.75) within group (order by idc) as p75
    from base group by family, year
),
zone as (
    select zone_id, year, count(*) as n,
           percentile_cont(0.5) within group (order by idc) as median
    from base where zone_id is not null group by zone_id, year
),
ranked as (
    select b.*,
           percent_rank() over (partition by family, year order by idc)            as peer_rank,
           case when zone_id is not null
                then percent_rank() over (partition by zone_id, year order by idc) end as zone_rank
    from base b
)
select r.egid, r.year, r.idc, r.idc_avg_3y, r.sre, r.final_energy_mwh, r.energy_source, r.family, r.zone_id,
       -- benchmark cantonale per famiglia
       p.n                                                         as peer_n,
       case when p.n >= analytics.min_peers() then round(p.median::numeric, 0) end as peer_median,
       case when p.n >= analytics.min_peers() then round(p.p25::numeric, 0)    end as peer_p25,
       case when p.n >= analytics.min_peers() then round(p.p75::numeric, 0)    end as peer_p75,
       case when p.n >= analytics.min_peers() then round((r.idc - p.median)::numeric, 0) end as delta_vs_peer,
       case when p.n >= analytics.min_peers() and p.median > 0
            then round(((r.idc - p.median) / p.median * 100)::numeric, 1) end   as delta_vs_peer_pct,
       case when p.n >= analytics.min_peers() then round((r.peer_rank * 100)::numeric, 0) end as peer_percentile,
       -- contesto di zona (solo zone con abbastanza edifici)
       z.n                                                         as zone_n,
       case when z.n >= analytics.min_peers() then round(z.median::numeric, 0) end as zone_median,
       case when z.n >= analytics.min_peers() and z.median > 0
            then round(((r.idc - z.median) / z.median * 100)::numeric, 1) end   as delta_vs_zone_pct,
       case when z.n >= analytics.min_peers() then round((r.zone_rank * 100)::numeric, 0) end as zone_percentile,
       -- trend a 3 anni (stesso edificio, anno - 3 esatto)
       t3.idc                                                      as idc_3y_ago,
       case when t3.idc > 0 then round(((r.idc - t3.idc) / t3.idc * 100)::numeric, 1) end as trend_3y_pct,
       -- soglie legali di Ginevra sulla media 3 anni (indicativo)
       (r.idc_avg_3y > 450)                                        as above_450,
       (r.idc_avg_3y > 800)                                        as above_significant_until_2026,
       (r.idc_avg_3y > 650)                                        as above_significant_from_2027,
       (r.year = max(r.year) over (partition by r.egid))           as is_latest
from ranked r
join peer p             on p.family = r.family and p.year = r.year
left join zone z        on z.zone_id = r.zone_id and z.year = r.year
left join core.energy_idc t3 on t3.egid = r.egid and t3.year = r.year - 3
with no data;

create unique index building_benchmark_pk  on analytics.building_benchmark (egid, year);
create index building_benchmark_latest_idx on analytics.building_benchmark (is_latest) where is_latest;
create index building_benchmark_zone_idx   on analytics.building_benchmark (zone_id, year);

create materialized view analytics.zone_metrics as
select bb.zone_id, z.zone_type, z.zone_name, z.slug, bb.year,
       count(*)                                                        as buildings,
       round(percentile_cont(0.5)  within group (order by bb.idc)::numeric, 0) as median_idc,
       round(percentile_cont(0.25) within group (order by bb.idc)::numeric, 0) as p25_idc,
       round(percentile_cont(0.75) within group (order by bb.idc)::numeric, 0) as p75_idc,
       round(sum(bb.sre)::numeric, 0)                                  as total_sre_m2,
       round(sum(bb.final_energy_mwh)::numeric, 0)                     as total_final_energy_mwh,
       count(*) filter (where bb.above_450)                            as buildings_above_450,
       count(*) filter (where bb.above_significant_from_2027)          as buildings_above_650,
       round(100.0 * avg(case when bb.idc > bb.peer_median then 1 else 0 end)
             filter (where bb.peer_median is not null), 1)             as share_above_peer_median_pct,
       (count(*) >= analytics.min_peers())                             as zone_benchmark_valid
from analytics.building_benchmark bb
join core.industrial_zones z using (zone_id)
group by bb.zone_id, z.zone_type, z.zone_name, z.slug, bb.year
with no data;

create unique index zone_metrics_pk on analytics.zone_metrics (zone_id, year);

-- Aggiornamento dopo ogni ETL (la prima volta senza CONCURRENTLY, perché le viste sono vuote)
create or replace function analytics.refresh_all() returns void
language plpgsql security definer set search_path = '' as $$
begin
    if (select ispopulated from pg_matviews where schemaname = 'analytics' and matviewname = 'building_benchmark') then
        refresh materialized view concurrently analytics.building_benchmark;
        refresh materialized view concurrently analytics.zone_metrics;
    else
        refresh materialized view analytics.building_benchmark;
        refresh materialized view analytics.zone_metrics;
    end if;
end $$;

revoke execute on function analytics.refresh_all() from public;
