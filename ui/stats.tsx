import type { StatsPayload } from "../sim/stats.ts";
import { godName, regionName } from "./header.tsx";

/**
 * 시뮬 통계 페이지. **리포트이지 게이트가 아니다** — 값을 보여줄 뿐 판정하지 않는다(판정은 `npm run tune` 하나).
 * 차트는 전부 인라인 SVG다: 데이터가 정적 JSON 한 장이라 라이브러리가 낼 것이 없고,
 * `renderToStaticMarkup`으로 테스트가 서버에서 그대로 그려 본다
 */

const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const stageLabel: Record<string, string> = { devotion: "헌신", calm: "평온", anger: "분노", wrath: "진노" };
const typeLabel: Record<string, string> = { combat: "전투", elite: "정예", boss: "보스" };

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stats-tile">
      <div className="stats-tile-value">{value}</div>
      <div className="stats-tile-label">{label}</div>
    </div>
  );
}

/** Δ 히스토그램 — 이봉. 가운데는 카드·감쇠 드리프트, 바깥은 요구의 보상·벌 */
function DeltaHistogram({ hist, steps }: { hist: Record<string, number>; steps: number }) {
  const entries = Object.entries(hist).map(([delta, count]) => [Number(delta), count] as const).sort((a, b) => a[0] - b[0]);
  const lo = entries[0]?.[0] ?? 0;
  const hi = entries.at(-1)?.[0] ?? 0;
  const max = Math.max(...entries.map(([, count]) => count), 1);
  const W = 720, H = 210, ml = 46, mr = 10, mt = 16, mb = 24;
  const x = (delta: number) => ml + (delta - lo) * (W - ml - mr) / (hi - lo + 1);
  const barW = Math.max((W - ml - mr) / (hi - lo + 1) - 1.2, 1.2);
  const y = (count: number) => mt + (max - count) * (H - mt - mb) / max;
  const gridStep = Math.ceil(max / 4 / 500) * 500 || 1;
  const grids = Array.from({ length: Math.floor(max / gridStep) + 1 }, (_, i) => i * gridStep);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="스냅샷 간 호의 변화량 히스토그램">
      {grids.map((g) => (
        <g key={g}>
          <line x1={ml} x2={W - mr} y1={y(g)} y2={y(g)} className="stats-grid" />
          <text x={ml - 6} y={y(g) + 3} textAnchor="end" className="stats-axis">{g}</text>
        </g>
      ))}
      {[-12, 12].map((v) => <line key={v} x1={x(v) + barW / 2} x2={x(v) + barW / 2} y1={mt} y2={H - mb} className="stats-guide" />)}
      <text x={x(-13)} y={mt + 2} textAnchor="end" className="stats-note">요구 벌 ←</text>
      <text x={x(0) + barW / 2} y={mt + 2} textAnchor="middle" className="stats-note">드리프트</text>
      <text x={x(13)} y={mt + 2} textAnchor="start" className="stats-note">→ 요구 보상</text>
      {/* lo·hi가 ±12에 붙으면 눈금이 겹친다 — 같은 자리에 두 번 그리지 않는다 */}
      {[...new Set([lo, -12, 0, 12, hi])].map((v) => <text key={v} x={x(v) + barW / 2} y={H - 8} textAnchor="middle" className="stats-axis">{v}</text>)}
      {entries.map(([delta, count]) => (
        <rect key={delta} x={x(delta)} y={y(count)} width={barW} height={H - mb - y(count)} rx={1}
          className={Math.abs(delta) >= 12 ? "stats-bar-strong" : "stats-bar"}>
          <title>{`Δ ${delta > 0 ? `+${delta}` : delta} · ${count}스텝 (${pct(count / steps)})`}</title>
        </rect>
      ))}
    </svg>
  );
}

/** 단계 점유율 — 순서 척도라 한 색의 농도로 편다. 정체는 색이 아니라 라벨이 든다 */
function StageBar({ share, compact }: { share: Record<string, number>; compact?: boolean }) {
  const opacities: Record<string, number> = { devotion: 1, calm: 0.62, anger: 0.34, wrath: 0.15 };
  return (
    <div className={`stats-stagebar${compact ? " compact" : ""}`}>
      {Object.entries(stageLabel).map(([stage, label]) => {
        const value = share[stage] ?? 0;
        return (
          <div key={stage} className="stats-stageseg" style={{ flexGrow: Math.max(value, 0.001) }}>
            <i style={{ opacity: opacities[stage] }} />
            {value >= 0.06 && <span>{label} {pct(value)}</span>}
          </div>
        );
      })}
    </div>
  );
}

function SamplePanel({ sample }: { sample: StatsPayload["favor"]["samples"][number] }) {
  const points = sample.points;
  const W = 720, H = 168, ml = 36, mr = 60, mt = 12, mb = 18;
  const x = (i: number) => ml + i * (W - ml - mr) / Math.max(points.length - 1, 1);
  const y = (v: number) => mt + (100 - v) * (H - mt - mb) / 100;
  const boundaries: [number, string][] = [[70, "헌신"], [30, "평온"], [10, "분노"], [0, "진노"]];
  return (
    <figure className="stats-panel">
      <figcaption>
        <b>{sample.label}</b> · {sample.gods.map(godName).join(" + ")} · {sample.won ? "승리" : "패배"}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sample.label} 호의 궤적`}>
        {boundaries.slice(0, 3).map(([v]) => <line key={v} x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} className="stats-guide" />)}
        {boundaries.map(([v, name]) => <text key={name} x={W - mr + 8} y={y(v) - 3} className="stats-note">{name}</text>)}
        {[0, 50, 100].map((v) => <text key={v} x={ml - 6} y={y(v) + 3} textAnchor="end" className="stats-axis">{v}</text>)}
        {sample.gods.map((god, gi) => (
          <g key={god} style={{ color: `var(--${god})` }}>
            <polyline points={points.map((row, i) => `${x(i)},${y(row[gi])}`).join(" ")} className="stats-line" />
            {points.map((row, i) => (
              <circle key={i} cx={x(i)} cy={y(row[gi])} r={3} className="stats-dot">
                <title>{`스냅샷 ${i} · ${godName(god)} ${row[gi]}`}</title>
              </circle>
            ))}
            <text x={x(0) + 2} y={y(points[0][gi]) + (gi ? 14 : -7)} className="stats-series-label">{godName(god)}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** 5×5 조합 승률. 색은 크기(농도) 하나만 들고 숫자가 정본이다 */
function PairingMatrix({ matrix }: { matrix: Record<string, Record<string, number | null>> }) {
  const names = Object.keys(matrix);
  const max = Math.max(...names.flatMap((a) => names.map((b) => matrix[a][b] ?? 0)), 0.01);
  return (
    <div className="stats-scroll">
      <table className="stats-matrix">
        <thead>
          <tr><th></th>{names.map((god) => <th key={god} scope="col"><i className="stats-chip" style={{ background: `var(--${god})` }} />{godName(god)}</th>)}</tr>
        </thead>
        <tbody>
          {names.map((left) => (
            <tr key={left}>
              <th scope="row"><i className="stats-chip" style={{ background: `var(--${left})` }} />{godName(left)}</th>
              {names.map((right) => {
                const value = matrix[left][right];
                return value === null
                  ? <td key={right} className="stats-diag">—</td>
                  : <td key={right} style={{ background: `color-mix(in srgb, var(--boon) ${Math.round((value / max) * 45)}%, transparent)` }}>{pct(value, 0)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarRow({ label, value, max, text, strong }: { label: string; value: number; max: number; text: string; strong?: boolean }) {
  return (
    <div className="stats-barrow">
      <span className="stats-barrow-label">{label}</span>
      <div className="stats-barrow-track">
        <i className={strong ? "stats-fill-strong" : "stats-fill"} style={{ width: `${Math.max((value / (max || 1)) * 100, 0.5)}%` }} />
      </div>
      <span className="stats-barrow-value">{text}</span>
    </div>
  );
}

/** 승/패 그룹 비교 — 같은 지표를 나란히. 판정 없이 값만 */
function WinVsLoss({ won, lost }: StatsPayload["winVsLoss"]) {
  const rows: [string, (g: typeof won) => number, (v: number) => string][] = [
    ["요구 이행률", (g) => g.demandKeptRate, (v) => pct(v)],
    ["요구 수락 / 런", (g) => g.demandAcceptedPerRun, (v) => v.toFixed(1)],
    ["은혜 / 런", (g) => g.gracePerRun, (v) => v.toFixed(1)],
    ["휴식 / 런", (g) => g.restPerRun, (v) => v.toFixed(1)],
    ["헌신 점유율", (g) => g.stageShare.devotion, (v) => pct(v)],
    ["진노 점유율", (g) => g.stageShare.wrath, (v) => pct(v)],
    ["최종 호의 격차(중앙값)", (g) => g.finalSpreadMedian, (v) => String(v)],
  ];
  return (
    <div className="stats-versus">
      <div className="stats-versus-head"><span>승리 {won.runs}런</span><span>패배 {lost.runs}런</span></div>
      {rows.map(([label, get, fmt]) => {
        const a = get(won), b = get(lost), max = Math.max(a, b);
        return (
          <div key={label} className="stats-versus-row">
            <BarRow label={label} value={a} max={max} text={fmt(a)} strong />
            <BarRow label="" value={b} max={max} text={fmt(b)} />
          </div>
        );
      })}
    </div>
  );
}

const byFloor = (a: string, b: string) => {
  const [ra, fa] = a.split(":"), [rb, fb] = b.split(":");
  return ra === rb ? Number(fa) - Number(fb) : ra === "underworld" ? -1 : 1;
};

export function StatsPage({ data }: { data: StatsPayload }) {
  const { meta, favor, clear, winVsLoss } = data;
  const defeatTotal = Object.values(clear.defeatByFloor).reduce((sum, count) => sum + count, 0) || 1;
  const clearKeys = Object.keys(clear.encounterClearRate).sort(byFloor);
  // 조합 수는 행렬의 축이 든다 — `simulateStratified`의 짝이 곧 이 축이라 신이 늘면 캡션이 따라 움직인다
  const godCount = Object.keys(clear.winRateMatrix).length;
  const pairings = (godCount * (godCount - 1)) / 2;
  return (
    <div className="stats-page">
      <header>
        <p className="eyebrow">결정론 층화 시뮬 · 조합 {pairings} × 시드 {meta.runs / pairings} · 봇 {meta.botPolicyVersion}</p>
        <h1>시뮬 통계</h1>
        <p className="stats-lead">
          룰 봇 {meta.runs}런의 실측. 판정은 여기 없다 — 밸런스 게이트는 <code>npm run tune</code> 하나다.
          {" "}<a href="./index.html">게임으로 →</a>
        </p>
        <div className="stats-tiles">
          <Tile value={pct(meta.winRate)} label={`승률 (${meta.wins}/${meta.runs})`} />
          <Tile value={String(meta.avgEncounters)} label="런당 조우" />
          <Tile value={String(favor.medianAbsDelta)} label="호의 변화 |Δ| 중앙값" />
          <Tile value={pct(favor.bigShare)} label="|Δ| ≥ 12 스텝 — 급변" />
        </div>
      </header>

      <section>
        <h2>우호도의 움직임</h2>
        <p>스냅샷은 노드 사이에 찍힌다 — 전투 안에서 호의는 움직이지 않는다. 분포는 이봉이다:
          가운데(+2 · 0 · −3)는 카드·감쇠 드리프트, 바깥(±12 이상)은 요구의 보상·벌이고 그 사이가 비어 있다.
          단계 경계를 넘는 스텝은 {pct(favor.crossShare)}다.</p>
        <figure className="stats-panel">
          <figcaption><b>스냅샷 간 Δ호의</b> · {favor.steps.toLocaleString()}스텝 (런 × 후원 2)</figcaption>
          <DeltaHistogram hist={favor.deltaHist} steps={favor.steps} />
        </figure>
        <figure className="stats-panel">
          <figcaption><b>단계 점유율</b> · 전체 스냅샷</figcaption>
          <StageBar share={favor.stageShare} />
        </figure>
        {favor.samples.map((sample) => <SamplePanel key={sample.label} sample={sample} />)}
      </section>

      <section>
        <h2>클리어 / 실패</h2>
        <figure className="stats-panel">
          <figcaption><b>조합 승률</b> · 신 {godCount} × {godCount}</figcaption>
          <PairingMatrix matrix={clear.winRateMatrix} />
        </figure>
        <div className="stats-cols">
          <figure className="stats-panel">
            <figcaption><b>조우 격파율</b> · 지역:층:종류</figcaption>
            {clearKeys.map((key) => {
              const [region, floor, type] = key.split(":");
              return <BarRow key={key} label={`${regionName(region)} ${floor}층 ${typeLabel[type] ?? type}`}
                value={clear.encounterClearRate[key]} max={1} text={pct(clear.encounterClearRate[key], 0)} strong />;
            })}
          </figure>
          <figure className="stats-panel">
            <figcaption><b>패배 지점</b> · 지역:층</figcaption>
            {Object.keys(clear.defeatByFloor).sort(byFloor).map((key) => {
              const [region, floor] = key.split(":");
              const count = clear.defeatByFloor[key];
              return <BarRow key={key} label={`${regionName(region)} ${floor}층`} value={count}
                max={Math.max(...Object.values(clear.defeatByFloor))} text={`${count} (${pct(count / defeatTotal, 0)})`} />;
            })}
            <figcaption style={{ marginTop: 12 }}><b>패배 조우의 패시브</b> · 합 &gt; 100% (겹침)</figcaption>
            {Object.entries(clear.defeatByPassive).sort((a, b) => b[1] - a[1]).map(([passive, share]) => (
              <BarRow key={passive} label={passive} value={share}
                max={Math.max(...Object.values(clear.defeatByPassive))} text={pct(share, 0)} />
            ))}
          </figure>
        </div>
      </section>

      <section>
        <h2>승리 런의 특징</h2>
        <p>같은 지표를 승/패 그룹으로 나란히 놓았다. 위 막대가 승리, 아래가 패배다.</p>
        <figure className="stats-panel">
          <WinVsLoss {...winVsLoss} />
        </figure>
        <div className="stats-cols">
          <figure className="stats-panel">
            <figcaption><b>승리 런의 단계 점유</b></figcaption>
            <StageBar share={winVsLoss.won.stageShare} compact />
          </figure>
          <figure className="stats-panel">
            <figcaption><b>패배 런의 단계 점유</b></figcaption>
            <StageBar share={winVsLoss.lost.stageShare} compact />
          </figure>
        </div>
      </section>
    </div>
  );
}
