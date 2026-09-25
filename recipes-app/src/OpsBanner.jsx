// Operations pulse banner — shown to approvers above the translation review
// queue. DEMO ONLY: every figure below is illustrative sample data, labelled
// as such in the UI, pending a real feed from the company's order/production
// systems. It links to the full demo snapshot at /admin/ops.html.

const DEMO = {
  ratePerDay: 22,                               // MT/day current run-rate
  backlogMt: 540,
  backlogHistory: [410, 450, 470, 520, 505, 540], // last 6 weeks
  nextOrder: { id: '#1042', customer: 'Mr. Falafel', totalMt: 240, remainingMt: 180, dueInDays: 6 },
  durum: { onHandMt: 200, reorderDays: 7, scaleDays: 21 },
};

const GAUGE_MAX = 6; // ± days shown on the dial
const CX = 110, CY = 104, R = 84;

function dueDateLabel(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const clamp = (v) => Math.max(-GAUGE_MAX, Math.min(GAUGE_MAX, v));
const tOf = (v) => (clamp(v) + GAUGE_MAX) / (2 * GAUGE_MAX);
function pt(t, rad) {
  const a = Math.PI - t * Math.PI;
  return [CX + rad * Math.cos(a), CY - rad * Math.sin(a)];
}
function arcPath(t0, t1) {
  const [x0, y0] = pt(t0, R), [x1, y1] = pt(t1, R);
  return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`;
}

// ≥1 day early = on track, within ±1 day = cutting it close, >1 day late = will miss
function status(v) {
  if (v <= -1) return { cls: 'good', label: '✓ On track', read: `${Math.abs(v).toFixed(1)} days ahead` };
  if (v <= 1) return { cls: 'warn', label: '◐ Cutting it close', read: `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} days` };
  return { cls: 'crit', label: '⚠ Will miss due date', read: `+${v.toFixed(1)} days late` };
}

function Sparkline({ values }) {
  const W = 170, H = 34, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [
    pad + (i * (W - 2 * pad)) / (values.length - 1),
    H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad),
  ]);
  const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="ops-spark" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Backlog over the last ${values.length} weeks, from ${values[0]} to ${values[values.length - 1]} MT`}>
      <polygon points={`${pad},${H - pad} ${line} ${lx},${H - pad}`} fill="#2a78d6" opacity="0.1" />
      <polyline points={line} fill="none" stroke="#2a78d6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill="#2a78d6" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function Gauge({ value }) {
  const gap = 0.006;
  const ticks = [-6, -3, 0, 3, 6];
  const deg = (clamp(value) / GAUGE_MAX) * 90;
  return (
    <svg viewBox="0 0 220 128" role="img" aria-label="Projected finish versus due date, from early to late">
      <path d={arcPath(0, tOf(-1) - gap)} fill="none" stroke="#0ca30c" strokeWidth="14" />
      <path d={arcPath(tOf(-1) + gap, tOf(1) - gap)} fill="none" stroke="#fab219" strokeWidth="14" />
      <path d={arcPath(tOf(1) + gap, 1)} fill="none" stroke="#d03b3b" strokeWidth="14" />
      {ticks.map((v) => {
        const t = tOf(v);
        const [x1, y1] = pt(t, R - 12), [x2, y2] = pt(t, R - 18), [lx, ly] = pt(t, R - 29);
        return (
          <g key={v}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="1.5" />
            <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize="9.5" fill="#6b7280">{v > 0 ? `+${v}` : v}</text>
          </g>
        );
      })}
      <g className="ops-needle" style={{ transform: `rotate(${deg}deg)` }}>
        <line x1={CX} y1={CY} x2={CX} y2="30" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx={CX} cy={CY} r="7" fill="#111827" />
      <circle cx={CX} cy={CY} r="2.5" fill="#fff" />
      <text x="16" y="124" fontSize="10" fill="#6b7280">early</text>
      <text x="204" y="124" fontSize="10" fill="#6b7280" textAnchor="end">late</text>
    </svg>
  );
}

export default function OpsBanner() {
  const { ratePerDay, backlogMt, backlogHistory, nextOrder, durum } = DEMO;
  const daysNeeded = nextOrder.remainingMt / ratePerDay;
  const slip = daysNeeded - nextOrder.dueInDays; // + = late
  const st = status(slip);
  const coverDays = durum.onHandMt / ratePerDay;
  const toReorder = coverDays - durum.reorderDays;

  return (
    <section className="ops-banner" aria-label="Operations pulse">
      <div className="ops-head">
        <span className="ops-title">Operations pulse</span>
        <span className="ops-demo" title="Illustrative sample data, not live company figures">Demo data</span>
        <a className="ops-link" href="/admin/ops.html">Full operations snapshot →</a>
      </div>
      <div className="ops-body">
        <div className="ops-tile">
          <span className="ops-label">Order backlog</span>
          <span className="ops-val ops-tnum">{backlogMt}<span className="ops-u">MT</span></span>
          <span className="ops-sub">≈ {(backlogMt / ratePerDay / 7).toFixed(1)} weeks at {ratePerDay} MT/day · rising</span>
          <Sparkline values={backlogHistory} />
        </div>

        <div className="ops-tile ops-gauge-tile">
          <div className="ops-gauge"><Gauge value={slip} /></div>
          <div className="ops-ginfo">
            <span className="ops-gorder">Next due: {nextOrder.id} · {nextOrder.customer} · {nextOrder.totalMt} MT · due {dueDateLabel(nextOrder.dueInDays)}</span>
            <span className="ops-gread ops-tnum">{st.read}</span>
            <span className={`ops-pill ops-pill-${st.cls}`}>{st.label}</span>
            <span className="ops-gcalc ops-tnum">
              {nextOrder.remainingMt} MT left ÷ {ratePerDay} MT/day = {daysNeeded.toFixed(1)} days · due in {nextOrder.dueInDays}
            </span>
          </div>
        </div>

        <div className="ops-tile">
          <span className="ops-label">Durum wheat on hand</span>
          <span className="ops-val ops-tnum">{Math.floor(coverDays)}<span className="ops-u">days of cover</span></span>
          <span className="ops-sub">{durum.onHandMt} MT · reorder point in {Math.max(0, Math.round(toReorder))} days</span>
          <div>
            <div className="ops-cover" role="img"
              aria-label={`${Math.floor(coverDays)} of ${durum.scaleDays} days of cover; reorder point at ${durum.reorderDays} days`}>
              <div className="ops-cover-fill" style={{ width: `${Math.min(100, (coverDays / durum.scaleDays) * 100).toFixed(1)}%` }} />
              <div className="ops-cover-rop" style={{ left: `${((durum.reorderDays / durum.scaleDays) * 100).toFixed(1)}%` }} title={`Reorder point: ${durum.reorderDays} days`} />
            </div>
            <div className="ops-cover-scale"><span>0</span><span>reorder · {durum.reorderDays}d</span><span>{durum.scaleDays} days</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
