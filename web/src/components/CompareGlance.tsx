// "A colpo d'occhio": tre visualizzazioni che mettono gli edifici sulla stessa scala.
// Qui i colori rappresentano solo le METRICHE (classe del benchmark, soglia 450, energia sopra la mediana);
// gli edifici sono identificati dalla lettera A–D su inchiostro neutro.
import { CLASS_COLOR, COMPARE_LETTERS, classOfBuilding, fmtNum } from "@/lib/format";

export type GlanceItem = {
  idc: number;
  peer_median: number | null;
  peer_percentile: number | null;
  is_stale: boolean;
  final_energy_mwh: number | null;
  gap_mwh: number | null;
  /** energia se l'edificio fosse alla mediana del gruppo = mediana × SRE / 3600 */
  median_mwh: number | null;
};

type Labels = {
  posTitle: string; posNote: string; noBenchmark: string; outdated: string;
  lower: string; typical: string; higher: string; median: string;
  idcTitle: string; idcLegendBar: string; idcLegendPeer: string; idcLegendThreshold: string;
  energyTitle: string; energyLegendBase: string; energyLegendAbove: string; aboveMedian: string;
  energyLegendBelow: string; energyLegendMedian: string; vsMedian: string; noMedian: string;
  energyColTotal: string; energyColDiff: string; atMedian: string; energyNote: string;
};

export default function CompareGlance({ items, labels: l, locale }: { items: GlanceItem[]; labels: Labels; locale: string }) {
  const n = (v: number | null) => fmtNum(v, locale);

  /* --- 1. posizione nel gruppo: tutti sulla stessa scala P0–P100 ---
     Edifici con percentile vicino (< 10 punti) vanno nello stesso segnaposto, lettere affiancate. */
  const withP = items.map((it, i) => ({ ...it, i })).filter((it) => it.peer_percentile != null)
    .sort((a, b) => a.peer_percentile! - b.peer_percentile!);
  const pins: { p: number; members: typeof withP }[] = [];
  for (const it of withP) {
    const last = pins[pins.length - 1];
    if (last && it.peer_percentile! - last.members[last.members.length - 1].peer_percentile! < 10) last.members.push(it);
    else pins.push({ p: it.peer_percentile!, members: [it] });
  }
  for (const pin of pins) pin.p = pin.members.reduce((s, m) => s + m.peer_percentile!, 0) / pin.members.length;
  const noP = items.map((it, i) => ({ ...it, i })).filter((it) => it.peer_percentile == null);

  /* --- 2. IDC vs mediana del gruppo, scala comune con la soglia 450 --- */
  const idcMax = Math.max(450, ...items.flatMap((it) => [it.idc, it.peer_median ?? 0])) * 1.08;
  const pct = (v: number) => `${Math.min(100, (v / idcMax) * 100)}%`;

  /* --- 3. energia termica stimata, con la parte sopra la mediana --- */
  const eMax = Math.max(1, ...items.map((it) => it.final_energy_mwh ?? 0)) * 1.02;
  const diffs = items.map((it) => (it.final_energy_mwh != null && it.median_mwh != null ? it.final_energy_mwh - it.median_mwh : null));
  const dMax = Math.max(1, ...diffs.map((d) => Math.abs(d ?? 0))) * 1.05;

  return (
    <div className="glance">
      {/* 1 */}
      <section className="card glance-card glance-wide">
        <h3 className="glance-title">{l.posTitle}</h3>
        <div className="pos-wrap" style={{ paddingTop: 40 }}>
          {pins.map((pin) => (
            <div key={pin.members.map((m) => m.i).join("")} className="pos-pin" style={{ left: `${pin.p}%`, bottom: 14 }}>
              <span className="pos-chips">
                {pin.members.map((m) => (
                  <span key={m.i} className={`cmp-letter cmp-c-${classOfBuilding(m.peer_percentile, m.is_stale)}${m.is_stale ? " cmp-letter-hollow" : ""}`}
                    title={`${COMPARE_LETTERS[m.i]} · P${Math.round(m.peer_percentile!)}${m.is_stale ? ` · ${l.outdated}` : ""}`}>
                    {COMPARE_LETTERS[m.i]}
                  </span>
                ))}
              </span>
              <span className="pos-stem" style={{ height: 6 }} />
            </div>
          ))}
          <div className="pos-track" />
        </div>
        <div className="pos-scale">
          <span style={{ left: "0%" }}>P0</span><span style={{ left: "25%" }}>P25</span>
          <span style={{ left: "50%" }}>{l.median}</span><span style={{ left: "75%" }}>P75</span><span style={{ left: "100%" }}>P100</span>
        </div>
        <div className="pos-zones small muted">
          <span style={{ width: "25%" }}>{l.lower}</span><span style={{ width: "50%" }}>{l.typical}</span><span style={{ width: "25%" }}>{l.higher}</span>
        </div>
        <p className="small muted glance-note">
          {l.posNote}
          {noP.length > 0 && <> {noP.map((it) => COMPARE_LETTERS[it.i]).join(", ")}: {l.noBenchmark}.</>}
          {items.some((it) => it.is_stale && it.peer_percentile != null) && <> <span className="cmp-letter cmp-letter-hollow cmp-letter-sm cmp-lx">·</span> {l.outdated}.</>}
        </p>
      </section>

      {/* 2 */}
      <section className="card glance-card glance-wide">
        <h3 className="glance-title">{l.idcTitle}</h3>
        <div className="bars">
          <div className="bars-threshold" style={{ left: `calc(30px + (100% - 30px - 52px) * ${450 / idcMax})` }}><span>450</span></div>
          {items.map((it, i) => {
            const cls = classOfBuilding(it.peer_percentile, it.is_stale);
            return (
              <div key={i} className="bar-row">
                <span className={`cmp-letter cmp-c-${classOfBuilding(it.peer_percentile, it.is_stale)}`}>{COMPARE_LETTERS[i]}</span>
                <div className="bar-area">
                  <div className="bar" style={{ width: pct(it.idc), background: CLASS_COLOR[cls] }} />
                  {it.peer_median != null && (
                    <div className="bar-peer" style={{ left: pct(it.peer_median) }} title={`${l.idcLegendPeer}: ${n(it.peer_median)}`} />
                  )}
                </div>
                <span className="bar-value num">{n(it.idc)}</span>
              </div>
            );
          })}
        </div>
        <div className="glance-legend small muted">
          <span><i className="lg-bar" /> {l.idcLegendBar}</span>
          <span><i className="lg-peer" /> {l.idcLegendPeer}</span>
          <span><i className="lg-thr" /> {l.idcLegendThreshold}</span>
        </div>
      </section>

      {/* 3 — energia termica stimata (a sinistra) e distanza dal livello mediano del gruppo (a destra) */}
      <section className="card glance-card glance-wide">
        <h3 className="glance-title">{l.energyTitle}</h3>
        <div className="egrid">
          <div className="egrid-head" />
          <div className="egrid-head">{l.energyColTotal}</div>
          <div className="egrid-head egrid-head-c">{l.energyColDiff}</div>
          {items.map((it, i) => {
            const e = it.final_energy_mwh;
            const d = diffs[i];
            const near = d != null && Math.abs(d) < 0.5;
            return (
              <div key={i} className="egrid-row">
                <span className={`cmp-letter cmp-c-${classOfBuilding(it.peer_percentile, it.is_stale)}`}>{COMPARE_LETTERS[i]}</span>
                <div className="etot">
                  <div className="etot-track"><div className="etot-bar" style={{ width: `${((e ?? 0) / eMax) * 100}%`, background: CLASS_COLOR[classOfBuilding(it.peer_percentile, it.is_stale)] }} /></div>
                  <span className="etot-val num">{n(e)}</span>
                </div>
                <div className="ediff">
                  <div className="ediff-track">
                    <div className="ediff-zero" />
                    {d != null && !near && (
                      <div className={`ediff-bar ${d > 0 ? "is-up" : "is-down"}`}
                        style={d > 0 ? { left: "50%", width: `${(d / dMax) * 50}%` } : { right: "50%", width: `${(-d / dMax) * 50}%` }} />
                    )}
                  </div>
                  <span className={`ediff-val num ${d == null || near ? "" : d > 0 ? "is-up" : "is-down"}`}>
                    {d == null ? l.noMedian : near ? l.atMedian : `${d > 0 ? "+" : "−"}${n(Math.abs(d))}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="small muted glance-note">{l.energyNote}</p>
      </section>
    </div>
  );
}
