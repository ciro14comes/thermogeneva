"""Pulizia e normalizzazione: regole di qualità del runbook."""
from datetime import datetime, timezone

from shapely.geometry import MultiPolygon, Polygon, shape

from . import config


def _ms_to_dt(v):
    if v is None:
        return None
    return datetime.fromtimestamp(v / 1000, tz=timezone.utc)


def _clean_str(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def to_ewkt(geojson_geom):
    """GeoJSON -> EWKT MultiPolygon in EPSG:2056 (None se mancante/non poligonale)."""
    if not geojson_geom:
        return None
    g = shape(geojson_geom)
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    if not isinstance(g, MultiPolygon) or g.is_empty:
        return None
    return f"SRID={config.SRID};{g.wkt}"


def clean_idc(rows):
    """Ritorna (righe_valide, statistiche_scarti). Una riga per EGID+anno."""
    stats = {"egid_mancante": 0, "anno_fuori_range": 0, "idc_negativo": 0, "duplicati": 0}
    best = {}
    for r in rows:
        egid, year, idc, sre = r.get("egid"), r.get("annee"), r.get("indice"), r.get("sre")
        if egid is None:
            stats["egid_mancante"] += 1
            continue
        if year is None or not (config.YEAR_MIN <= year <= config.YEAR_MAX):
            stats["anno_fuori_range"] += 1
            continue
        if idc is not None and idc < 0:
            stats["idc_negativo"] += 1
            continue
        rec = {
            "objectid": int(r["objectid"]),
            "egid": int(egid),
            "year": int(year),
            "idc": idc,
            "sre": sre if (sre is not None and sre > 0) else None,   # SRE non valida -> NULL
            "idc_avg_2y": r.get("indice_moy2"),
            "idc_avg_3y": r.get("indice_moy3"),
            "years_avg_2y": _clean_str(r.get("annees_concernees_moy_2")),
            "years_avg_3y": _clean_str(r.get("annees_concernees_moy_3")),
            "period_start": _ms_to_dt(r.get("date_debut_periode")),
            "period_end": _ms_to_dt(r.get("date_fin_periode")),
            "entered_at": _ms_to_dt(r.get("date_saisie")),
            "energy_source_1": _clean_str(r.get("agent_energetique_1")),
            "energy_source_2": _clean_str(r.get("agent_energetique_2")),
            "energy_source_3": _clean_str(r.get("agent_energetique_3")),
            "address": _clean_str(r.get("adresse")),
            "postal_code": _clean_str(r.get("npa")),
            "commune": _clean_str(r.get("commune")),
            "destination": _clean_str(r.get("destination")),
        }
        key = (rec["egid"], rec["year"])
        if key in best:
            stats["duplicati"] += 1
            # regola deterministica: data di inserimento più recente, poi objectid più alto
            old = best[key]
            min_dt = datetime.min.replace(tzinfo=timezone.utc)
            if (rec["entered_at"] or min_dt, rec["objectid"]) <= (old["entered_at"] or min_dt, old["objectid"]):
                continue
        best[key] = rec
    return list(best.values()), stats


def latest_per_building(records):
    """Per ogni EGID la riga dell'anno più recente (fornisce indirizzo, destinazione e geometria)."""
    latest, years = {}, {}
    for r in records:
        e = r["egid"]
        years.setdefault(e, []).append(r["year"])
        if e not in latest or r["year"] > latest[e]["year"]:
            latest[e] = r
    for e, r in latest.items():
        r["first_year"], r["last_year"] = min(years[e]), max(years[e])
    return latest
