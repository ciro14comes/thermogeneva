"""
ThermoGeneva — Step 0: data profiling sprint
Scarica IDC (SITG/OCEN) e zone FTI, esegue il join spaziale e produce un report.

Uso:
    pip install requests pandas geopandas shapely tabulate
    python thermogeneva_profiling.py

Output (cartella ./data):
    raw/idc_<data>.csv          tutte le righe IDC + centroide (EPSG:2056)
    raw/fti_<data>.geojson      poligoni zone FTI
    idc_in_zones_<data>.csv     righe IDC assegnate a una zona
    profile_report_<data>.md    report di profilazione
"""
from datetime import date
from pathlib import Path
import time

import geopandas as gpd
import pandas as pd
import requests

BASE = "https://vector.sitg.ge.ch/arcgis/rest/services/Hosted"
IDC_URL = f"{BASE}/SCANE_INDICE_MOYENNES_3_ANS/FeatureServer/0/query"
FTI_URL = f"{BASE}/FTI_PERIMETRE/FeatureServer/0/query"
PAGE = 2000
MIN_PEERS = 10
# Allowlist (Addendum privacy): niente campi respondent/contatto, concessionario, NBRE_PRENEUR
IDC_FIELDS = ",".join([
    "objectid", "egid", "adresse", "npa", "commune", "destination", "annee",
    "sre", "indice", "indice_moy2", "indice_moy3",
    "annees_concernees_moy_2", "annees_concernees_moy_3",
    "date_debut_periode", "date_fin_periode", "date_saisie",
    "agent_energetique_1", "quantite_agent_energetique_1", "unite_agent_energetique_1",
    "agent_energetique_2", "agent_energetique_3",
])
FTI_FIELDS = "objectid,n_zone,nom,nom_zone,sous_zone,surf_zone"
TODAY = date.today().isoformat()

OUT = Path("data")
RAW = OUT / "raw"
RAW.mkdir(parents=True, exist_ok=True)
session = requests.Session()


def get(url, params, retries=4):
    for attempt in range(retries):
        try:
            r = session.get(url, params=params, timeout=60)
            r.raise_for_status()
            js = r.json()
            if "error" in js:
                raise RuntimeError(js["error"])
            return js
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  errore ({e}), riprovo tra {wait}s")
            time.sleep(wait)


def download_idc() -> pd.DataFrame:
    total = get(IDC_URL, {"where": "1=1", "returnCountOnly": "true", "f": "json"})["count"]
    print(f"IDC: {total} righe da scaricare")
    rows, offset = [], 0
    while offset < total:
        js = get(IDC_URL, {
            "where": "1=1",
            "outFields": IDC_FIELDS,
            "returnGeometry": "false",
            "returnCentroid": "true",
            "outSR": 2056,
            "orderByFields": "objectid",
            "resultOffset": offset,
            "resultRecordCount": PAGE,
            "f": "json",
        })
        feats = js.get("features", [])
        if not feats:
            break
        for f in feats:
            rec = dict(f["attributes"])
            c = f.get("centroid") or {}
            rec["cx"], rec["cy"] = c.get("x"), c.get("y")
            rows.append(rec)
        offset += len(feats)
        print(f"  {offset}/{total}", end="\r")
    print()
    df = pd.DataFrame(rows)
    for col in ("date_debut_periode", "date_fin_periode", "date_saisie"):
        if col in df:
            df[col] = pd.to_datetime(df[col], unit="ms", errors="coerce")
    return df


def download_fti() -> gpd.GeoDataFrame:
    r = session.get(FTI_URL, params={
        "where": "1=1", "outFields": FTI_FIELDS, "outSR": 2056, "f": "geojson",
    }, timeout=60)
    r.raise_for_status()
    gdf = gpd.GeoDataFrame.from_features(r.json()["features"], crs=2056)
    gdf = gdf.rename(columns={"objectid": "zone_id", "n_zone": "zone_type"})
    return gdf


def pct(n, d):
    return f"{(100 * n / d):.1f}%" if d else "n/a"


def main():
    idc = download_idc()
    idc.to_csv(RAW / f"idc_{TODAY}.csv", index=False)

    fti = download_fti()
    fti.to_file(RAW / f"fti_{TODAY}.geojson", driver="GeoJSON")
    print(f"FTI: {len(fti)} poligoni")

    # --- join spaziale: centroide dentro la zona ---
    pts = gpd.GeoDataFrame(
        idc.dropna(subset=["cx", "cy"]),
        geometry=gpd.points_from_xy(idc.dropna(subset=["cx", "cy"])["cx"],
                                    idc.dropna(subset=["cx", "cy"])["cy"]),
        crs=2056,
    )
    joined = gpd.sjoin(pts, fti[["zone_id", "zone_type", "surf_zone", "geometry"]],
                       how="inner", predicate="within")
    multi = joined.groupby("objectid").size()
    n_multi = int((multi > 1).sum())
    joined = joined.drop_duplicates("objectid")
    joined.drop(columns="geometry").to_csv(OUT / f"idc_in_zones_{TODAY}.csv", index=False)

    # --- profilazione ---
    n = len(idc)
    L = [f"# ThermoGeneva — profiling report ({TODAY})", ""]
    L += ["## Volumi", f"- Righe IDC totali: {n}",
          f"- EGID distinti: {idc['egid'].nunique()}",
          f"- Zone FTI: {len(fti)} (tipi: {', '.join(sorted(fti['zone_type'].astype(str).unique()))})",
          f"- Righe senza centroide: {idc['cx'].isna().sum()}", ""]

    L += ["## Righe per anno (tutto il cantone vs dentro zone FTI)",
          "| anno | cantone | in zone FTI | EGID in zone |", "|---|---|---|---|"]
    by_year = idc.groupby("annee").size()
    in_year = joined.groupby("annee").size()
    egid_year = joined.groupby("annee")["egid"].nunique()
    for y in by_year.index:
        L.append(f"| {y} | {by_year[y]} | {in_year.get(y, 0)} | {egid_year.get(y, 0)} |")
    L.append("")

    L += ["## Qualità dati (tutto il cantone)"]
    for col in ("egid", "annee", "sre", "indice", "indice_moy2", "indice_moy3",
                "destination", "agent_energetique_1"):
        if col in idc:
            L.append(f"- Null `{col}`: {idc[col].isna().sum()} ({pct(idc[col].isna().sum(), n)})")
    dup = idc.dropna(subset=["egid"]).duplicated(["egid", "annee"], keep=False).sum()
    L += [f"- Righe con anno = 0: {(idc['annee'] == 0).sum()}",
          f"- Righe con EGID+anno duplicato: {dup}",
          f"- SRE <= 0: {(idc['sre'] <= 0).sum()}",
          f"- IDC <= 0: {(idc['indice'] <= 0).sum()}",
          f"- Righe IDC in più zone (edge case): {n_multi}", ""]

    q = idc[["indice", "sre"]].quantile([0.01, 0.05, 0.5, 0.95, 0.99]).round(1)
    L += ["## Distribuzioni IDC (MJ/m²/a) e SRE (m²)", q.to_markdown(), ""]

    hist = idc.dropna(subset=["egid"]).groupby("egid")["annee"].nunique()
    L += ["## Profondità storica per EGID",
          f"- Mediana anni per edificio: {hist.median():.0f}",
          f"- Edifici con >= 3 anni: {(hist >= 3).sum()} ({pct((hist >= 3).sum(), len(hist))})", ""]

    # anno di riferimento = ultimo anno con copertura "piena" (>= 80% del massimo)
    counts = in_year.drop(index=0, errors="ignore")
    ref_year = int(counts[counts >= 0.8 * counts.max()].index.max()) if len(counts) else None
    L += [f"## Peer group (anno di riferimento {ref_year}, minimo {MIN_PEERS} peer)"]
    if ref_year:
        ref = joined[joined["annee"] == ref_year]
        z = ref.groupby("zone_id").size()
        zd = ref.groupby(["zone_id", "destination"]).size()
        L += [f"- Edifici nell'anno: {len(ref)}",
              f"- Zone con >= {MIN_PEERS} edifici: {(z >= MIN_PEERS).sum()} / {len(fti)}",
              f"- Gruppi zona+destinazione con >= {MIN_PEERS}: {(zd >= MIN_PEERS).sum()} / {len(zd)}",
              f"- Edifici coperti da un gruppo zona+destinazione valido: "
              f"{pct(zd[zd >= MIN_PEERS].sum(), len(ref))}", "",
              "### Top 20 destinazioni nelle zone FTI",
              ref["destination"].value_counts().head(20).to_markdown(), ""]

    report = OUT / f"profile_report_{TODAY}.md"
    report.write_text("\n".join(L), encoding="utf-8")
    print(f"Report scritto in {report}")


if __name__ == "__main__":
    main()
