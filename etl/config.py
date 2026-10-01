"""Configurazione ETL ThermoGeneva: sorgenti, allowlist dei campi, regole di qualità."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # in GitHub Actions le variabili arrivano dai secrets
    pass

DB_URL = os.environ.get("SUPABASE_DB_URL")

BASE = "https://vector.sitg.ge.ch/arcgis/rest/services/Hosted"
IDC_LAYER = f"{BASE}/SCANE_INDICE_MOYENNES_3_ANS/FeatureServer/0"
FTI_LAYER = f"{BASE}/FTI_PERIMETRE/FeatureServer/0"
SRID = 2056

# Allowlist (Addendum privacy): solo questi campi entrano nel database.
# Esclusi di proposito: bat_c_adr*_repondant, id_concessionnaire, nbre_preneur.
IDC_FIELDS = [
    "objectid", "egid", "adresse", "npa", "commune", "destination", "annee",
    "sre", "indice", "indice_moy2", "indice_moy3",
    "annees_concernees_moy_2", "annees_concernees_moy_3",
    "date_debut_periode", "date_fin_periode", "date_saisie",
    "agent_energetique_1", "quantite_agent_energetique_1", "unite_agent_energetique_1",
    "agent_energetique_2", "agent_energetique_3",
]
FTI_FIELDS = ["objectid", "n_zone", "nom", "nom_zone", "sous_zone", "surf_zone"]

# Campi senza i quali l'ETL si ferma (schema drift)
IDC_REQUIRED = {"objectid", "egid", "annee", "sre", "indice", "destination"}
FTI_REQUIRED = {"objectid", "n_zone", "surf_zone"}

YEAR_MIN, YEAR_MAX = 2000, 2100

# Assegnazione edificio -> zona
MIN_OVERLAP_RATIO = 0.5   # sotto questa soglia si usa il punto interno all'edificio
