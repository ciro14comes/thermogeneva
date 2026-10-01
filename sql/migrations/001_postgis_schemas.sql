-- ThermoGeneva — 001: PostGIS + schemi
create extension if not exists postgis with schema extensions;

create schema if not exists raw;
create schema if not exists core;
create schema if not exists analytics;

comment on schema raw is 'ThermoGeneva: snapshot dei dati sorgente SITG (solo campi in allowlist)';
comment on schema core is 'ThermoGeneva: entità pulite e normalizzate (edifici, IDC annuale, zone, assegnazioni)';
comment on schema analytics is 'ThermoGeneva: KPI e benchmark pronti per il sito';
