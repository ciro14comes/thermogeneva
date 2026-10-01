// NON USATO PER ORA (le pagine edificio sono noindex, quindi gli URL restano /buildings/EGID).
// Da riattivare se un giorno le pagine edificio verranno indicizzate (esclusi gli edifici residenziali).
// Indirizzi web leggibili per gli edifici: /buildings/chemin-du-tourbillon-10-plan-les-ouates-295040175
// La parte testuale (via + comune) aiuta persone e motori di ricerca; l'EGID in fondo è l'identificativo
// vero: se l'indirizzo cambia o è scritto male, la pagina si trova lo stesso e reindirizza a quello giusto.

function slugify(text: string): string {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // toglie gli accenti (é → e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Ultima parte dell'indirizzo web di un edificio (senza /buildings/). */
export function buildingSlug(b: { egid: number; address?: string | null; commune?: string | null }): string {
  const commune = (b.commune ?? "").replace(/\s+GE$/i, ""); // "Carouge GE" → "Carouge"
  const text = slugify([b.address ?? "", commune].filter(Boolean).join(" "));
  return text ? `${text}-${b.egid}` : String(b.egid);
}

export function buildingPath(b: { egid: number; address?: string | null; commune?: string | null }): string {
  return `/buildings/${buildingSlug(b)}`;
}

/** Ricava l'EGID dall'indirizzo: accetta sia "295040175" sia "chemin-...-295040175". */
export function egidFromParam(param: string): number | null {
  const m = /^(?:[a-z0-9-]*-)?(\d{1,10})$/.exec(param);
  return m ? Number(m[1]) : null;
}
