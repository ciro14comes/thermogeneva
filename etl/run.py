"""ThermoGeneva ETL — punto di ingresso.

Uso (dalla cartella del progetto, con l'ambiente attivo):
    python -m etl.run            # scarica, valida e carica in Supabase
    python -m etl.run --dry-run  # scarica e valida, senza scrivere nel database
"""
import sys
import time

from . import config, fetch, load, transform


def main(dry_run=False):
    t0 = time.time()
    print("1/5  Controllo schema sorgenti")
    idc_info = fetch.layer_info(config.IDC_LAYER)
    fti_info = fetch.layer_info(config.FTI_LAYER)
    schema_hash = fetch.check_schema(idc_info, config.IDC_REQUIRED) + ":" + \
        fetch.check_schema(fti_info, config.FTI_REQUIRED)
    page = idc_info.get("standardMaxRecordCountNoGeometry") or idc_info.get("maxRecordCount", 2000)

    print("2/5  Download attributi IDC")
    raw_rows = fetch.fetch_attributes(config.IDC_LAYER, config.IDC_FIELDS, page)

    print("3/5  Pulizia")
    records, stats = transform.clean_idc(raw_rows)
    latest = transform.latest_per_building(records)
    rejected = sum(v for k, v in stats.items() if k != "duplicati")
    print(f"    righe valide {len(records)} | edifici {len(latest)} | scarti {stats}")

    print("4/5  Download geometrie (edifici + zone FTI)")
    geoms = fetch.fetch_geometries(config.IDC_LAYER, [r["objectid"] for r in latest.values()])
    buildings = []
    for r in latest.values():
        b = dict(r)
        b["geom"] = transform.to_ewkt(geoms.get(r["objectid"]))
        buildings.append(b)
    no_geom = sum(1 for b in buildings if b["geom"] is None)
    zones = []
    for f in fetch.fetch_features_geojson(config.FTI_LAYER, config.FTI_FIELDS):
        z = {k: f["properties"].get(k) for k in config.FTI_FIELDS}
        z["objectid"] = z["objectid"] or f.get("id")
        z["geom"] = transform.to_ewkt(f.get("geometry"))
        zones.append(z)
    canton_name, canton_geom = fetch.fetch_canton()
    canton = (canton_name, transform.to_ewkt(canton_geom))
    print(f"    edifici senza geometria: {no_geom} | zone: {len(zones)} | confine cantonale: {'ok' if canton[1] else 'mancante'}")

    if dry_run:
        print(f"Dry-run completato in {time.time() - t0:.0f}s (nessuna scrittura).")
        return

    print("5/5  Caricamento in Supabase")
    with load.connect() as conn:
        run_id = load.start_run(conn, "sitg_idc+fti", schema_hash)
        try:
            loaded = load.load_all(conn, run_id, raw_rows, records, buildings, zones, canton)
        except Exception as e:
            conn.rollback()
            load.finish_run(conn, run_id, "failed", len(raw_rows), 0, rejected, str(e)[:500])
            raise
        load.finish_run(conn, run_id, "success", len(raw_rows), loaded, rejected,
                        f"edifici={len(buildings) - no_geom}; senza_geom={no_geom}; {stats}")
    print(f"Fatto in {time.time() - t0:.0f}s: {loaded} righe IDC caricate (run {run_id}).")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
