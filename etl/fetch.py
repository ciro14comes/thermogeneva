"""Download dai servizi ArcGIS REST del SITG, con paginazione e controllo dello schema."""
import hashlib
import json
import time

import requests

from . import config

session = requests.Session()
session.headers["User-Agent"] = "ThermoGeneva-ETL (https://thermogeneva.ch)"


def _get(url, params, retries=5):
    for attempt in range(retries):
        try:
            r = session.get(url, params=params, timeout=90)
            r.raise_for_status()
            js = r.json()
            if "error" in js:
                raise RuntimeError(js["error"])
            return js
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"    errore ({e}); riprovo tra {wait}s")
            time.sleep(wait)


def layer_info(layer_url):
    return _get(layer_url, {"f": "json"})


def check_schema(info, required):
    """Ferma l'ETL se mancano campi obbligatori. Ritorna l'hash dello schema."""
    fields = {f["name"]: f["type"] for f in info["fields"]}
    missing = required - fields.keys()
    if missing:
        raise RuntimeError(f"Schema drift: campi mancanti {sorted(missing)}")
    return hashlib.sha256(json.dumps(sorted(fields.items())).encode()).hexdigest()[:16]


def fetch_attributes(layer_url, fields, page_size):
    """Tutte le righe, senza geometria (più veloce)."""
    q = f"{layer_url}/query"
    total = _get(q, {"where": "1=1", "returnCountOnly": "true", "f": "json"})["count"]
    rows, offset = [], 0
    while offset < total:
        js = _get(q, {
            "where": "1=1", "outFields": ",".join(fields), "returnGeometry": "false",
            "orderByFields": "objectid", "resultOffset": offset,
            "resultRecordCount": page_size, "f": "json",
        })
        feats = js.get("features", [])
        if not feats:
            break
        rows.extend(f["attributes"] for f in feats)
        offset += len(feats)
        print(f"    {offset}/{total}", end="\r")
    print()
    if len(rows) < total:
        raise RuntimeError(f"Download incompleto: {len(rows)}/{total}")
    return rows


def fetch_geometries(layer_url, objectids, batch=250):
    """GeoJSON (EPSG:2056) solo per gli objectid richiesti. Ritorna {objectid: geometry}."""
    q = f"{layer_url}/query"
    out, ids = {}, list(objectids)
    for i in range(0, len(ids), batch):
        chunk = ids[i:i + batch]
        js = _get(q, {
            "objectIds": ",".join(map(str, chunk)), "outFields": "objectid",
            "returnGeometry": "true", "outSR": config.SRID, "f": "geojson",
        })
        for f in js.get("features", []):
            oid = f.get("id") or f["properties"]["objectid"]
            out[int(oid)] = f.get("geometry")
        print(f"    geometrie {min(i + batch, len(ids))}/{len(ids)}", end="\r")
    print()
    return out


def fetch_features_geojson(layer_url, fields):
    """Layer piccoli (zone FTI): attributi + geometria in un colpo."""
    js = _get(f"{layer_url}/query", {
        "where": "1=1", "outFields": ",".join(fields),
        "returnGeometry": "true", "outSR": config.SRID, "f": "geojson",
    })
    return js["features"]
