-- ThermoGeneva — 003: destinazioni presenti negli anni storici, mancanti nella mappatura iniziale
insert into core.destination_family (destination, family) values
 ('Cabine T+T','tecnico'),('Instal. tech. élec.','tecnico'),('Parking public','tecnico'),('Gare','tecnico'),
 ('Chantier naval','industria'),
 ('Hangar agricole','altro'),('Serre','altro'),
 ('Cinéma','cultura_sport'),('Stand de tir','cultura_sport')
on conflict (destination) do update set family = excluded.family;
