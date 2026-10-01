-- ThermoGeneva — 009: nomi ufficiali delle zone industriali
-- Fonte: FTI (Fondation pour les terrains industriels de Genève), guichet cartographique
--   https://www.ftige.ch/ecoparcs/  →  layer "Zones industrielles FTI" (45 zone, nome + baricentro).
-- Il layer SITG FTI_PERIMETRE (i nostri 60 poligoni) non ha nomi: li assegniamo per posizione.
-- Regola: punto ufficiale dentro il poligono, altrimenti il più vicino entro 300 m, altrimenti nessun nome.
-- Se più poligoni hanno lo stesso nome: quartiere se diverso (es. "PAV · Carouge"), altrimenti "· secteur 2".
-- La funzione core.apply_zone_labels() viene richiamata dall'ETL a ogni aggiornamento.

create table if not exists core.zone_labels (
    label_key     text primary key,                      -- nome come nel layer FTI
    display_name  text not null,                         -- nome mostrato sul sito
    pt            extensions.geometry(Point, 2056) not null,
    source        text not null default 'FTI — Zones industrielles FTI (guichet cartographique)'
);
alter table core.zone_labels enable row level security;

-- Correzioni manuali (rare): poligono → nome ufficiale
create table if not exists core.zone_label_overrides (
    zone_id    integer primary key,
    label_key  text not null references core.zone_labels(label_key),
    note       text
);
alter table core.zone_label_overrides enable row level security;

insert into core.zone_labels (label_key, display_name, pt)
select k, d, extensions.ST_Transform(extensions.ST_SetSRID(extensions.ST_MakePoint(x, y), 4326), 2056)
from (values
  ('AIRE','Aïre',6.093061,46.196195),
  ('BACHET-DE-PESAY','Bachet-de-Pesay',6.132785,46.174746),
  ('BOIS-BRULE','Bois-Brûlé',6.128198,46.246235),
  ('BOIS DE LA GRILLE','Bois-de-la-Grille',6.098980,46.214529),
  ('BOIS DES ARTS','Bois-des-Arts',6.201189,46.187967),
  ('CANADA','Canada',6.079840,46.206144),
  ('CHEMIN DE LA MOUSSE','Chemin de la Mousse',6.203508,46.196693),
  ('GRANGE-FALQUET','Grange-Falquet',6.184998,46.198631),
  ('LA CHAPELLE','La Chapelle',6.129757,46.171432),
  ('LA PALLANTERIE','La Pallanterie',6.217375,46.246638),
  ('LA PLAINE','La Plaine',6.005165,46.177296),
  ('LA RENFILE','La Renfile',6.100913,46.215895),
  ('LA SCIE','La Scie',6.166837,46.275162),
  ('LA SUSETTE','La Susette',6.121872,46.236950),
  ('LES EPINGLIS','Les Épinglis',6.098526,46.147471),
  ('LE SAPAY','Le Sapay',6.126232,46.170422),
  ('LES CHARMILLES','Les Charmilles',6.119761,46.209643),
  ('LES CHENEVIERS','Les Cheneviers',6.032665,46.195128),
  ('LES CHERPINES','Les Cherpines',6.096427,46.169297),
  ('LES FAYARDS','Les Fayards',6.166680,46.273228),
  ('LES ROUETTES','Les Rouettes',6.079438,46.185178),
  ('LES TUILERIES','Les Tuileries',6.103436,46.211437),
  ('MOILLESULAZ','Moillesulaz',6.210197,46.193909),
  ('MOLARD','Molard',6.161703,46.275621),
  ('MON IDEE','Mon-Idée',6.223235,46.204515),
  ('PAV','PAV',6.131419,46.187067),
  ('PONT BUTIN','Pont-Butin',6.110793,46.194450),
  ('RAMBOSSONS','Rambossons',6.123143,46.178159),
  ('ROSEMONT','Rosemont',6.171208,46.204139),
  ('ROUTE DE SAINT-JULIEN','Route de Saint-Julien',6.133779,46.176866),
  ('SECHERON','Sécheron',6.147126,46.221435),
  ('VALAVRAN','Valavran',6.137959,46.255159),
  ('VIA MONNET','Via Monnet',6.082939,46.217881),
  ('ZDAM MEYRIN SATIGNY','ZDAM Meyrin-Satigny',6.074845,46.223802),
  ('ZIBAT','ZIBAT',6.088704,46.221557),
  ('ZIBAY','ZIBAY',6.058688,46.197832),
  ('ZILI','ZILI',6.101979,46.207495),
  ('ZIMEYSA','ZIMEYSA',6.057847,46.224743),
  ('ZIMEYSA RELIEE AU RAIL','ZIMEYSA reliée au rail',6.064381,46.219101),
  ('ZIMOGA','ZIMOGA',6.075993,46.218044),
  ('ZIPLO','ZIPLO',6.106589,46.167123),
  ('ZIRIAN','ZIRIAN',6.085136,46.226444),
  ('ZITUIL','ZITUIL',6.071163,46.207626),
  ('PAPETERIE','Papeterie',6.165338,46.277336),
  ('FORESTAL','Forestal',6.015596,46.152643)
) as v(k, d, x, y)
on conflict (label_key) do update set display_name = excluded.display_name, pt = excluded.pt;

-- Poligono ZD2 della Praille (Carouge): fa parte del PAV, ma il punto più vicino è "Route de Saint-Julien"
insert into core.zone_label_overrides (zone_id, label_key, note)
values (59, 'PAV', 'ZD2 Praille, perimetro PAV')
on conflict (zone_id) do update set label_key = excluded.label_key, note = excluded.note;

create or replace function core.apply_zone_labels()
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  -- svuota prima gli slug (sono unique: evita collisioni durante lo scambio)
  update core.industrial_zones set slug = null, zone_name = null;

  with m as (
    select z.zone_id, extensions.ST_Area(z.geom) as area,
           coalesce(
             (select o.label_key from core.zone_label_overrides o where o.zone_id = z.zone_id),
             (select l.label_key from core.zone_labels l
               where extensions.ST_Intersects(z.geom, l.pt) limit 1),
             (select l.label_key from core.zone_labels l
               where extensions.ST_DWithin(z.geom, l.pt, 300)
               order by extensions.ST_Distance(z.geom, l.pt) limit 1)) as label_key,
           (select regexp_replace(b.commune, ' GE$', '')
              from core.building_zone bz join core.buildings b using (egid)
             where bz.zone_id = z.zone_id and b.commune is not null
             group by b.commune order by count(*) desc, b.commune limit 1) as commune
    from core.industrial_zones z
  ), a as (
    select m.*, l.display_name,
           count(*) over (partition by m.label_key) as n_same,
           (select count(distinct m2.commune) from m m2 where m2.label_key = m.label_key) as n_communes,
           (select count(*) from core.building_zone bz where bz.zone_id = m.zone_id) as n_buildings
    from m join core.zone_labels l using (label_key)
  ), b as (
    -- quartiere nel nome solo se i pezzi della stessa zona stanno in località diverse
    select a.*,
           case when n_same > 1 and n_communes > 1 and commune is not null
                then display_name || ' · ' || commune else display_name end as base_name
    from a
  ), c as (
    select b.*,
           row_number() over (partition by base_name order by n_buildings desc, area desc, zone_id) as rn
    from b
  ), f as (
    select zone_id,
           case when rn = 1 then base_name
                when base_name = display_name then base_name || ' · secteur ' || rn
                else base_name || ' (' || rn || ')' end as final_name
    from c
  )
  update core.industrial_zones z
     set zone_name = f.final_name,
         slug = trim(both '-' from regexp_replace(
                  lower(translate(f.final_name,
                    'àâäáéèêëíîïóôöùûüúçÀÂÄÁÉÈÊËÍÎÏÓÔÖÙÛÜÚÇ',
                    'aaaaeeeeiiiooouuuucAAAAEEEEIIIOOOUUUUC')),
                  '[^a-z0-9]+', '-', 'g'))
    from f
   where f.zone_id = z.zone_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function core.apply_zone_labels() from public, anon, authenticated;

select core.apply_zone_labels();
select analytics.refresh_all();
