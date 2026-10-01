-- ThermoGeneva — 002: tabelle raw + core (V1)
-- Principi: allowlist dei campi (niente répondant/concessionnaire/NBRE_PRENEUR),
-- geometria salvata una volta per edificio, una riga per EGID+anno.

-- =========================================================
-- RAW: snapshot sorgente (solo campi ammessi)
-- =========================================================
create table if not exists raw.sitg_idc (
    objectid                  bigint       not null,
    egid                      bigint,
    adresse                   text,
    npa                       text,
    commune                   text,
    destination               text,
    annee                     smallint,
    sre                       double precision,
    indice                    double precision,
    indice_moy2               double precision,
    indice_moy3               double precision,
    annees_concernees_moy_2   text,
    annees_concernees_moy_3   text,
    date_debut_periode        timestamptz,
    date_fin_periode          timestamptz,
    date_saisie               timestamptz,
    agent_energetique_1       text,
    quantite_agent_energetique_1 double precision,
    unite_agent_energetique_1 text,
    agent_energetique_2       text,
    agent_energetique_3       text,
    geom                      extensions.geometry(MultiPolygon, 2056),
    snapshot_id               bigint       not null,
    primary key (snapshot_id, objectid)
);

create table if not exists raw.fti_zones (
    objectid     bigint not null,
    n_zone       text,
    nom          text,
    nom_zone     text,
    sous_zone    text,
    surf_zone    bigint,
    geom         extensions.geometry(MultiPolygon, 2056),
    snapshot_id  bigint not null,
    primary key (snapshot_id, objectid)
);

-- =========================================================
-- CORE: entità pulite
-- =========================================================

-- Tipo di edificio -> famiglia per il benchmark cantonale
create table if not exists core.destination_family (
    destination  text primary key,
    family       text not null check (family in (
        'industria','logistica','uffici','commercio_servizi','tecnico',
        'residenziale','residenziale_misto','istruzione','sanitario',
        'cultura_sport','culto','altro'))
);

-- Zone industriali FTI (nome/slug da completare a mano: il layer non li fornisce)
create table if not exists core.industrial_zones (
    zone_id      integer primary key,          -- objectid sorgente
    zone_type    text not null,                 -- ZIA, ZDIA, ZD2, ...
    zone_name    text,                          -- es. 'ZIMEY' (manuale)
    slug         text unique,                   -- es. 'zimey' (URL /zones/[slug])
    surface_m2   bigint,
    geom         extensions.geometry(MultiPolygon, 2056) not null,
    updated_at   timestamptz not null default now()
);

-- Edificio: una riga per EGID, geometria una volta sola
create table if not exists core.buildings (
    egid         bigint primary key,
    address      text,
    postal_code  text,
    commune      text,
    destination  text,
    geom         extensions.geometry(MultiPolygon, 2056) not null,
    first_year   smallint,
    last_year    smallint,
    updated_at   timestamptz not null default now()
);

-- IDC annuale: una riga per EGID + anno
create table if not exists core.energy_idc (
    egid            bigint   not null references core.buildings(egid) on delete cascade,
    year            smallint not null check (year between 2000 and 2100),
    idc             double precision check (idc is null or idc >= 0),   -- MJ/m²/anno
    sre             double precision check (sre is null or sre > 0),    -- m²
    idc_avg_2y      double precision,
    idc_avg_3y      double precision,
    years_avg_2y    text,
    years_avg_3y    text,
    period_start    date,
    period_end      date,
    energy_source_1 text,
    energy_source_2 text,
    energy_source_3 text,
    entered_at      timestamptz,
    primary key (egid, year)
);

-- Assegnazione edificio -> zona (auditabile)
create table if not exists core.building_zone (
    egid              bigint primary key references core.buildings(egid) on delete cascade,
    zone_id           integer references core.industrial_zones(zone_id),
    assignment_method text not null check (assignment_method in
                        ('largest_overlap','point_on_surface','unassigned')),
    overlap_ratio     double precision,
    assigned_at       timestamptz not null default now()
);

-- Log ETL
create table if not exists core.etl_runs (
    run_id        bigint generated always as identity primary key,
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    status        text not null default 'running' check (status in ('running','success','failed')),
    source        text not null,
    rows_fetched  integer,
    rows_loaded   integer,
    rows_rejected integer,
    schema_hash   text,
    message       text
);

-- =========================================================
-- Indici
-- =========================================================
create index if not exists buildings_geom_gix        on core.buildings using gist (geom);
create index if not exists zones_geom_gix            on core.industrial_zones using gist (geom);
create index if not exists energy_idc_year_idx       on core.energy_idc (year);
create index if not exists building_zone_zone_idx    on core.building_zone (zone_id);
create index if not exists raw_idc_snapshot_egid_idx on raw.sitg_idc (snapshot_id, egid, annee);

-- =========================================================
-- Sicurezza: RLS attiva ovunque (l'ETL usa il ruolo di servizio)
-- =========================================================
alter table raw.sitg_idc            enable row level security;
alter table raw.fti_zones           enable row level security;
alter table core.destination_family enable row level security;
alter table core.industrial_zones   enable row level security;
alter table core.buildings          enable row level security;
alter table core.energy_idc         enable row level security;
alter table core.building_zone      enable row level security;
alter table core.etl_runs           enable row level security;

-- =========================================================
-- Mappatura destinazioni -> famiglie (valori reali del layer IDC)
-- =========================================================
insert into core.destination_family (destination, family) values
 ('Usine','industria'),('Atelier','industria'),('Autre bât. d''activités','industria'),
 ('Dépôt','logistica'),('Hangar','logistica'),('Silo','logistica'),('Port-franc','logistica'),('Dépôt TPG','logistica'),
 ('Bureaux','uffici'),('Bureaux des OIG','uffici'),('Administrations publiques','uffici'),('Mairie','uffici'),
 ('Mission permanente','uffici'),('Consulat','uffici'),
 ('Commerce','commercio_servizi'),('Centre commercial','commercio_servizi'),('Restaurant','commercio_servizi'),
 ('Hôtel','commercio_servizi'),('Halle d''exposition','commercio_servizi'),('Station-service','commercio_servizi'),
 ('Garage','tecnico'),('Garage privé','tecnico'),('Voirie-entretien','tecnico'),('Service du feu','tecnico'),
 ('Installation de chauffage','tecnico'),('Bât. électricité SIG','tecnico'),('Instal. tech. élec. SIG','tecnico'),
 ('Station d''épuration','tecnico'),('Déchetterie','tecnico'),('Central de télécom.','tecnico'),
 ('Ouvrage aéroportuaire','tecnico'),('Arsenal','tecnico'),('Caserne','tecnico'),('Douane','tecnico'),
 ('Poste','tecnico'),('Sécurité civile','tecnico'),('Police','tecnico'),('Cheminée','tecnico'),
 ('Hab plusieurs logements','residenziale'),('Habitation un logement','residenziale'),('Hab. deux logements','residenziale'),
 ('Résidence meublée','residenziale'),('Foyer','residenziale'),('Internat','residenziale'),('Autre héberg. collectif','residenziale'),
 ('Hab. - rez activités','residenziale_misto'),('Habitation - activités','residenziale_misto'),
 ('Ecole primaire','istruzione'),('Collège','istruzione'),('Autre école','istruzione'),('Ecole privée','istruzione'),
 ('Université','istruzione'),('Jardin d''enfants','istruzione'),('Conservatoire musique','istruzione'),
 ('EMS','sanitario'),('Hôpital, Clinique','sanitario'),('Hôpital Clinique','sanitario'),('Etablissement de soins','sanitario'),
 ('Salle de sport','cultura_sport'),('Centre sportif','cultura_sport'),('Centre de loisirs','cultura_sport'),
 ('Autre bât. de loisirs','cultura_sport'),('Salle communale','cultura_sport'),('Musée','cultura_sport'),
 ('Salle de spectacle','cultura_sport'),('Théâtre','cultura_sport'),('Bibliothèque','cultura_sport'),
 ('Piscine','cultura_sport'),('Stade','cultura_sport'),('Patinoire','cultura_sport'),('Manège','cultura_sport'),
 ('Autre équipement collectif','cultura_sport'),
 ('Eglise','culto'),('Temple','culto'),('Chapelle','culto'),('Autre lieu de culte','culto'),('Synagogue','culto'),('Mosquée','culto'),
 ('Etab. pénitenciaire','altro'),('Autre bât. 20m2 et plus','altro'),('Autre bât. < 20 m2','altro'),
 ('Autre prod. agricole','altro'),('Ferme','altro')
on conflict (destination) do update set family = excluded.family;
