import { SCENARIO_LIMITS, withAreaGreenTimes, withAreaRoad, type Scenario, type ScenarioArea } from "@traffic-simulator/scenario";
import { useEffect, useMemo, useState } from "react";
import { guessKindName, guessTable, type GuessCell } from "./area-guesses";
import { osmViewUrl } from "./area-picking";
import { NumberField } from "./NumberField";
import "./area-panel.css";

/**
 * Shown under the views while an imported area is on screen: the
 * OpenStreetMap attribution and licence, the area's data to save, and every
 * value of the network marked as from OpenStreetMap, guessed (with its rule)
 * or corrected. The planner corrects lanes, widths and green times here;
 * a correction changes what the baseline is, not the proposal.
 */
export function AreaPanel({
  scenario,
  area,
  refusal,
  onCorrect,
}: {
  scenario: Scenario;
  area: ScenarioArea;
  /** Why the last correction (or change) was not made. */
  refusal: string | undefined;
  onCorrect: (next: Scenario) => void;
}) {
  const table = useMemo(() => guessTable(area), [area]);
  const imported = area.imported;
  const [dataUrl, setDataUrl] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(imported, null, 2)}\n`], { type: "application/json" }));
    setDataUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imported]);
  const guessedCount = imported.guesses.filter((guess) => guess.guessed).length;

  return (
    <section className="area-panel corridor-notice" aria-label="Imported area" data-testid="area-panel">
      <p data-testid="osm-attribution">
        Map data{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {imported.attribution}
        </a>{" "}
        (data as of {imported.osmDataTimestamp ?? "an unknown date"}). The imported network is a database made from OpenStreetMap and is
        offered under the{" "}
        <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
          Open Database Licence (ODbL) 1.0
        </a>
        :{" "}
        {dataUrl && (
          <a href={dataUrl} download="imported-area.json" data-testid="area-data">
            imported-area.json
          </a>
        )}{" "}
        (the network, the guesses and how the importer departed from what OpenStreetMap draws).{" "}
        <a href={osmViewUrl(area.bounds)} target="_blank" rel="noreferrer">
          The area on OpenStreetMap
        </a>
        .
      </p>
      {refusal && (
        <p className="refused" data-testid="correction-refused" role="alert">
          Not changed. {refusal}.
        </p>
      )}
      <details open data-testid="area-guesses">
        <summary>
          What OpenStreetMap gives, what is guessed ({guessedCount} values), and corrections
        </summary>
        <p className="hint">
          <strong className="guessed">guessed</strong> values come from the rules below; <strong className="corrected">corrected</strong>{" "}
          values are yours. Correct lanes, widths and green times before running: a correction changes the baseline (and the
          proposal with it), and is kept in the link and the file.
        </p>
        <h4>Roads</h4>
        <div className="area-table-scroll">
          <table className="area-table" data-testid="area-roads">
            <thead>
              <tr>
                <th>Road</th>
                <th>Lanes</th>
                <th>Width</th>
                <th>Speed limit</th>
                <th>Level</th>
                <th>Correct lanes</th>
                <th>Correct width (m)</th>
              </tr>
            </thead>
            <tbody>
              {table.roads.map((row) => (
                <tr key={row.roadId} data-testid={`area-road-${row.roadId}`}>
                  <td title={row.roadId}>{row.name}</td>
                  <Cell cell={row.lanes} />
                  <Cell cell={row.width} />
                  <Cell cell={row.speed} />
                  <Cell cell={row.level} />
                  <td>
                    <NumberField
                      label=""
                      testId={`area-lanes-${row.roadId}`}
                      value={row.lanesNow}
                      min={1}
                      max={SCENARIO_LIMITS.lanes}
                      whole
                      onCommit={(lanes) => onCorrect(withAreaRoad(scenario, row.roadId, { lanes }))}
                    />
                  </td>
                  <td>
                    <NumberField
                      label=""
                      testId={`area-width-${row.roadId}`}
                      value={row.widthNow}
                      min={1}
                      max={SCENARIO_LIMITS.roadWidthM}
                      step={0.5}
                      onCommit={(widthM) => onCorrect(withAreaRoad(scenario, row.roadId, { widthM }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>Junctions</h4>
        {table.junctions.length === 0 ? (
          <p className="hint">No signal or priority junction in this area.</p>
        ) : (
          <ul className="area-junctions" data-testid="area-junctions">
            {table.junctions.map((row) => (
              <li key={row.junctionId} data-testid={`area-junction-${row.junctionId}`}>
                <strong>{row.name}</strong>: <CellText cell={row.control} />
                {row.plan && row.greenS && (
                  <>
                    {" "}
                    · signal plan <CellText cell={row.plan} />
                    <div className="change-control">
                      {row.greenS.map((green, at) => (
                        <NumberField
                          key={`${row.junctionId}-${at}`}
                          label={`Green for ${row.phaseNames?.[at] ?? `phase ${at + 1}`} (s)`}
                          testId={`area-green-${row.junctionId}-${at}`}
                          value={green}
                          min={1}
                          max={SCENARIO_LIMITS.signalSeconds}
                          onCommit={(seconds) =>
                            onCorrect(withAreaGreenTimes(scenario, row.junctionId, row.greenS!.map((one, index) => (index === at ? seconds : one))))
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <h4>Demand</h4>
        <ul data-testid="area-demand">
          {table.demand.map((row) => (
            <li key={row.name}>
              {row.name}: <CellText cell={row.cell} />
            </li>
          ))}
        </ul>
        <h4>The rules that guessed</h4>
        <dl className="area-rules" data-testid="area-rules">
          {table.rules.map((rule) => (
            <div key={rule.text}>
              <dt>{guessKindName(rule.kind)}</dt>
              <dd>{rule.text}</dd>
            </div>
          ))}
        </dl>
        {imported.adjustments.length > 0 && (
          <details>
            <summary>How the network departs from what OpenStreetMap draws ({imported.adjustments.length})</summary>
            <ul>
              {imported.adjustments.map((text, at) => (
                <li key={at}>{text}</li>
              ))}
            </ul>
          </details>
        )}
      </details>
    </section>
  );
}

function marker(cell: GuessCell) {
  if (cell.corrected) return <span className="corrected"> corrected</span>;
  if (cell.guessed) return <span className="guessed"> guessed</span>;
  return <span className="from-osm"> OpenStreetMap</span>;
}

function Cell({ cell }: { cell: GuessCell }) {
  return (
    <td title={cell.source} data-guessed={cell.guessed} data-corrected={cell.corrected}>
      {cell.value}
      {marker(cell)}
    </td>
  );
}

function CellText({ cell }: { cell: GuessCell }) {
  return (
    <span title={cell.source} data-guessed={cell.guessed}>
      {cell.value}
      {marker(cell)}
    </span>
  );
}
