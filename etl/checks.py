"""Controlli di qualità prima (e alla fine) del caricamento.

Confrontano i dati appena scaricati con quelli già nel database. Se qualcosa non torna
(molte righe in meno, campi improvvisamente vuoti, zone sparite…) il caricamento si ferma,
il sito continua a mostrare i dati della settimana precedente e GitHub manda un'email di errore.

Per forzare comunque il caricamento (dopo aver verificato a mano che il cambiamento è reale):
    python -m etl.run --force        oppure  ETL_FORCE=1  (in GitHub: Run workflow → force)
"""
import os

# Soglie: abbastanza larghe da non scattare per le normali variazioni settimanali
MIN_KEEP_RATIO = 0.90        # righe / edifici: errore se ne resta meno del 90 % rispetto all'ultima volta
MAX_GROWTH_RATIO = 1.25      # avviso (non errore) se crescono più del 25 %
MIN_ZONES = 10               # le zone FTI sono ~60
MIN_ZONES_RATIO = 0.80
MAX_NULL_INCREASE = 0.10     # quota di IDC/SRE vuoti: errore se sale di oltre 10 punti percentuali
MAX_NO_GEOM_SHARE = 0.05     # edifici senza geometria
MAX_REJECTED_SHARE = 0.05    # righe scartate dalla pulizia


class QualityError(RuntimeError):
    """Il caricamento è stato fermato dai controlli di qualità."""


def _ratio(cur, prev):
    return None if not prev else cur / prev


def compare(cur: dict, prev: dict) -> tuple[list[str], list[str]]:
    """Ritorna (errori, avvisi). `prev` vuoto = primo caricamento: solo i controlli assoluti."""
    errors, warnings = [], []

    def drop(key, label):
        if key not in cur:
            return
        r = _ratio(cur[key], prev.get(key))
        if r is None:
            return
        if r < MIN_KEEP_RATIO:
            errors.append(f"{label}: {cur[key]} contro {prev[key]} dell'ultima volta (-{(1 - r) * 100:.0f} %)")
        elif r > MAX_GROWTH_RATIO:
            warnings.append(f"{label}: {cur[key]} contro {prev[key]} (+{(r - 1) * 100:.0f} %)")

    drop("raw_rows", "Righe IDC scaricate")
    drop("buildings", "Edifici con geometria")
    drop("site_buildings", "Edifici mostrati sul sito")

    if "zones" in cur:
        if cur["zones"] < MIN_ZONES:
            errors.append(f"Zone FTI: solo {cur['zones']} (minimo {MIN_ZONES})")
        elif prev.get("zones") and cur["zones"] < MIN_ZONES_RATIO * prev["zones"]:
            errors.append(f"Zone FTI: {cur['zones']} contro {prev['zones']} dell'ultima volta")

    if prev.get("max_year") and cur.get("max_year") and cur["max_year"] < prev["max_year"]:
        errors.append(f"Anno più recente: {cur['max_year']} (prima {prev['max_year']}): mancano dichiarazioni recenti")

    for key, label in (("idc_null_share", "IDC vuoti"), ("sre_null_share", "SRE vuote o non valide")):
        if key in cur and prev.get(key) is not None and cur[key] > prev[key] + MAX_NULL_INCREASE:
            errors.append(f"{label}: {cur[key] * 100:.1f} % delle righe (prima {prev[key] * 100:.1f} %)")

    if cur.get("no_geom_share", 0) > MAX_NO_GEOM_SHARE:
        errors.append(f"Edifici senza geometria: {cur['no_geom_share'] * 100:.1f} % (massimo {MAX_NO_GEOM_SHARE * 100:.0f} %)")
    if cur.get("rejected_share", 0) > MAX_REJECTED_SHARE:
        errors.append(f"Righe scartate dalla pulizia: {cur['rejected_share'] * 100:.1f} % (massimo {MAX_REJECTED_SHARE * 100:.0f} %)")

    return errors, warnings


def enforce(errors: list[str], warnings: list[str], force: bool, stage: str) -> None:
    """Stampa l'esito; con errori ferma tutto, a meno che non sia stato chiesto --force."""
    for w in warnings:
        print(f"    ⚠ {w}")
    for e in errors:
        print(f"    ✖ {e}")
    if errors and not force:
        raise QualityError(f"Controlli di qualità ({stage}) non superati: " + "; ".join(errors))
    if errors and force:
        print("    --force: caricamento eseguito nonostante gli errori")


def is_forced(argv) -> bool:
    return "--force" in argv or os.environ.get("ETL_FORCE", "").lower() in ("1", "true", "yes")


def write_summary(cur: dict, prev: dict, errors: list[str], warnings: list[str]) -> None:
    """Tabella di confronto nel riepilogo di GitHub Actions (se presente)."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    fmt = lambda v: "—" if v is None else (f"{v * 100:.1f} %" if isinstance(v, float) and v < 1 else str(v))  # noqa: E731
    lines = ["", "| Controllo | Ora | Ultima volta |", "|---|---|---|"]
    for k in sorted(set(cur) | set(prev)):
        lines.append(f"| {k} | {fmt(cur.get(k))} | {fmt(prev.get(k))} |")
    if errors:
        lines += ["", "**Errori**", *[f"- {e}" for e in errors]]
    if warnings:
        lines += ["", "**Avvisi**", *[f"- {w}" for w in warnings]]
    with open(path, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
