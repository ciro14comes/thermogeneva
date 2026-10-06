"""Caricamento in Supabase (PostgreSQL + PostGIS) in un'unica transazione."""
import psycopg

from . import config

ENERGY_COLS = ["egid", "year", "idc", "sre", "idc_avg_2y", "idc_avg_3y", "years_avg_2y",
               "years_avg_3y", "period_start", "period_end", "energy_source_1",
               "energy_source_2", "energy_source_3", "entered_at"]
BUILDING_COLS = ["egid", "address", "postal_code", "commune", "destination",
                 "geom", "first_year", "last_year"]


def connect():
    if not config.DB_URL:
        raise RuntimeError("Manca SUPABASE_DB_URL (file .env o secret GitHub)")
    return psycopg.connect(config.DB_URL, prepare_threshold=None)


def start_run(conn, source, schema_hash):
    with conn.cursor() as cur:
        cur.execute("insert into core.etl_runs (source, schema_hash) values (%s, %s) returning run_id",
                    (source, schema_hash))
        run_id = cur.fetchone()[0]
    conn.commit()
    return run_id


def baseline(conn):
    """Numeri dell'ultimo caricamento riuscito (ciò che c'è ora nel database), per i controlli di qualità."""
    with conn.cursor() as cur:
        cur.execute("""
            select (select count(*) from raw.sitg_idc),
                   (select avg((indice is null)::int)::float from raw.sitg_idc),
                   (select avg((sre is null or sre <= 0)::int)::float from raw.sitg_idc),
                   (select count(*) from core.buildings),
                   (select count(*) from core.industrial_zones),
                   (select max(year) from core.energy_idc),
                   (select count(*) from public.buildings_latest)""")
        r = cur.fetchone()
    keys = ["raw_rows", "idc_null_share", "sre_null_share", "buildings", "zones", "max_year", "site_buildings"]
    return {k: v for k, v in zip(keys, r) if v is not None}


def finish_run(conn, run_id, status, fetched=None, loaded=None, rejected=None, message=None):
    with conn.cursor() as cur:
        cur.execute("""update core.etl_runs set finished_at = now(), status = %s, rows_fetched = %s,
                       rows_loaded = %s, rows_rejected = %s, message = %s where run_id = %s""",
                    (status, fetched, loaded, rejected, message, run_id))
    conn.commit()


def _copy(cur, table, cols, rows):
    with cur.copy(f"copy {table} ({', '.join(cols)}) from stdin") as cp:
        for r in rows:
            cp.write_row([r.get(c) for c in cols])


def load_all(conn, run_id, raw_rows, records, buildings, zones, canton=None, final_check=None):
    """raw -> core in una transazione: o tutto o niente.
    `final_check(numero_edifici_sul_sito)` viene chiamato prima del commit: se solleva un errore,
    tutto il caricamento viene annullato e il sito resta con i dati precedenti."""
    with conn.transaction(), conn.cursor() as cur:
        # --- RAW: snapshot attributi IDC (senza geometria) e zone FTI; tiene solo l'ultimo snapshot
        raw_cols = [c for c in config.IDC_FIELDS] + ["snapshot_id"]
        cur.execute("delete from raw.sitg_idc")
        cur.execute("delete from raw.fti_zones")
        _copy(cur, "raw.sitg_idc", raw_cols, [
            {**r, "snapshot_id": run_id,
             "egid": None if r.get("egid") is None else int(r["egid"]),  # nel layer è double
             "date_debut_periode": _ms(r.get("date_debut_periode")),
             "date_fin_periode": _ms(r.get("date_fin_periode")),
             "date_saisie": _ms(r.get("date_saisie"))}
            for r in raw_rows])
        _copy(cur, "raw.fti_zones", config.FTI_FIELDS + ["geom", "snapshot_id"],
              [{**z, "snapshot_id": run_id} for z in zones])

        # --- CORE: zone (zone_name/slug li calcola core.apply_zone_labels() più sotto)
        cur.execute("""
            insert into core.industrial_zones (zone_id, zone_type, surface_m2, geom, updated_at)
            select objectid, coalesce(n_zone, 'n/a'), surf_zone,
                   extensions.ST_Multi(extensions.ST_MakeValid(geom)), now()
            from raw.fti_zones
            on conflict (zone_id) do update set zone_type = excluded.zone_type,
                surface_m2 = excluded.surface_m2, geom = excluded.geom, updated_at = now()""")
        cur.execute("""delete from core.industrial_zones z
                       where not exists (select 1 from raw.fti_zones r where r.objectid = z.zone_id)""")

        # --- CORE: edifici (staging temporaneo + upsert)
        cur.execute("create temp table stg_buildings (like core.buildings including defaults) on commit drop")
        _copy(cur, "stg_buildings", BUILDING_COLS, buildings)
        cur.execute("""
            insert into core.buildings (egid, address, postal_code, commune, destination, geom,
                                        first_year, last_year, updated_at)
            select egid, address, postal_code, commune, destination,
                   extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_MakeValid(geom), 3)),
                   first_year, last_year, now()
            from stg_buildings where geom is not null
            on conflict (egid) do update set address = excluded.address, postal_code = excluded.postal_code,
                commune = excluded.commune, destination = excluded.destination, geom = excluded.geom,
                first_year = excluded.first_year, last_year = excluded.last_year, updated_at = now()""")
        cur.execute("""delete from core.buildings b
                       where not exists (select 1 from stg_buildings s where s.egid = b.egid)""")

        # --- CORE: IDC annuale
        cur.execute("create temp table stg_energy (like core.energy_idc) on commit drop")
        _copy(cur, "stg_energy", ENERGY_COLS, records)
        cur.execute(f"""
            insert into core.energy_idc ({', '.join(ENERGY_COLS)})
            select {', '.join('s.' + c for c in ENERGY_COLS)}
            from stg_energy s join core.buildings b using (egid)
            on conflict (egid, year) do update set
            {', '.join(f'{c} = excluded.{c}' for c in ENERGY_COLS[2:])}""")
        cur.execute("""delete from core.energy_idc e
                       where not exists (select 1 from stg_energy s where s.egid = e.egid and s.year = e.year)""")
        cur.execute("select count(*) from core.energy_idc")
        loaded = cur.fetchone()[0]

        # --- CORE: assegnazione edificio -> zona
        cur.execute("truncate core.building_zone")
        cur.execute("""
            with ov as (
                select b.egid, z.zone_id,
                       extensions.ST_Area(extensions.ST_Intersection(b.geom, z.geom))
                         / nullif(extensions.ST_Area(b.geom), 0) as ratio
                from core.buildings b
                join core.industrial_zones z on extensions.ST_Intersects(b.geom, z.geom)
            ), best as (
                select distinct on (egid) egid, zone_id, ratio
                from ov order by egid, ratio desc nulls last, zone_id
            )
            insert into core.building_zone (egid, zone_id, assignment_method, overlap_ratio)
            select b.egid,
                   case when bs.ratio >= %(min)s then bs.zone_id else pz.zone_id end,
                   case when bs.ratio >= %(min)s then 'largest_overlap'
                        when pz.zone_id is not null then 'point_on_surface'
                        else 'unassigned' end,
                   bs.ratio
            from core.buildings b
            left join best bs using (egid)
            left join lateral (
                select z.zone_id from core.industrial_zones z
                where extensions.ST_Contains(z.geom, extensions.ST_PointOnSurface(b.geom))
                order by z.zone_id limit 1
            ) pz on true""", {"min": config.MIN_OVERLAP_RATIO})

        # --- CORE: confine cantonale (per la maschera della mappa)
        if canton and canton[1]:
            cur.execute("""
                insert into core.canton_boundary (canton_code, name, geom, updated_at)
                values ('GE', %s, extensions.ST_Multi(extensions.ST_Force2D(extensions.ST_MakeValid(extensions.ST_GeomFromEWKT(%s)))), now())
                on conflict (canton_code) do update set name = excluded.name, geom = excluded.geom, updated_at = now()""",
                canton)

        # --- CORE: nomi ufficiali FTI delle zone (assegnati per posizione, vedi migrazione 009)
        cur.execute("select core.apply_zone_labels()")

        # --- ANALYTICS: ricalcola benchmark e metriche di zona
        cur.execute("select analytics.refresh_all()")

        # --- CONTROLLO FINALE: quanti edifici vedrà il sito (ancora dentro la transazione)
        if final_check:
            cur.execute("select count(*) from public.buildings_latest")
            final_check(cur.fetchone()[0])
    return loaded


def _ms(v):
    from datetime import datetime, timezone
    return None if v is None else datetime.fromtimestamp(v / 1000, tz=timezone.utc)
