import { areaAround, checkArea, type AreaBounds } from "@traffic-simulator/corridor";
import { areaBaseline, type Scenario } from "@traffic-simulator/scenario";
import { useState } from "react";
import { importAreaFromOsm } from "./area-import";
import { AREA_PRESETS, AREA_SIZES_M, osmViewUrl, parseCentre } from "./area-picking";

const CENTRE = "centre";

/**
 * Importing a place from OpenStreetMap: the planner picks a preset area, or
 * gives a centre and a size, and imports it. The browser asks the public
 * Overpass server once; the area becomes the baseline, with every guessed
 * value listed beside it. An area that cannot be imported is refused with the
 * reason and nothing is opened.
 */
export function AreaImport({ onImport }: { onImport: (baseline: Scenario) => void }) {
  const [picked, setPicked] = useState(AREA_PRESETS[0]!.id);
  const [centre, setCentre] = useState("12.9352, 77.6245");
  const [sizeM, setSizeM] = useState<number>(750);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "asking" } | { kind: "refused"; message: string }>({ kind: "idle" });

  let bounds: AreaBounds | undefined;
  let problem: string | undefined;
  if (picked === CENTRE) {
    const read = parseCentre(centre);
    if (read.ok) bounds = areaAround(read.value, sizeM);
    else problem = read.message;
  } else {
    bounds = AREA_PRESETS.find((preset) => preset.id === picked)?.bounds;
  }
  const checked = bounds ? checkArea(bounds) : undefined;
  if (checked && !checked.ok) problem = checked.message;

  const start = async () => {
    if (!bounds) return;
    setState({ kind: "asking" });
    const name = picked === CENTRE ? undefined : AREA_PRESETS.find((preset) => preset.id === picked)?.name;
    const imported = await importAreaFromOsm(bounds, name);
    if (!imported.ok) {
      setState({ kind: "refused", message: imported.message });
      return;
    }
    setState({ kind: "idle" });
    onImport(areaBaseline(imported.value));
  };

  return (
    <div className="area-import" data-testid="area-import">
      <div className="change-control">
        <label>
          Area
          <select data-testid="area-preset" className="wide" value={picked} onChange={(event) => setPicked(event.target.value)}>
            {AREA_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            <option value={CENTRE}>Around a point I give…</option>
          </select>
        </label>
      </div>
      {picked === CENTRE && (
        <div className="change-control">
          <label>
            Centre (latitude, longitude)
            <input data-testid="area-centre" value={centre} onChange={(event) => setCentre(event.target.value)} />
          </label>
          <label>
            Size
            <select data-testid="area-size" value={sizeM} onChange={(event) => setSizeM(Number(event.target.value))}>
              {AREA_SIZES_M.map((size) => (
                <option key={size} value={size}>
                  {size >= 1000 ? `${size / 1000} km` : `${size} m`} square
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="hint">
        Copy a point from any map (in most map apps, press and hold, or right-click, on the place). Main roads only: motorways,
        trunk, primary, secondary and tertiary roads with their slip roads.{" "}
        {bounds && !problem && (
          <a href={osmViewUrl(bounds)} target="_blank" rel="noreferrer" data-testid="area-view">
            See the box on OpenStreetMap
          </a>
        )}
      </p>
      {problem && (
        <p className="refused" data-testid="area-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="change-control">
        <button type="button" data-testid="area-import-start" disabled={!bounds || problem !== undefined || state.kind === "asking"} onClick={() => void start()}>
          {state.kind === "asking" ? "Importing…" : "Import and run as the baseline"}
        </button>
      </div>
      {state.kind === "asking" && (
        <p className="hint" data-testid="area-asking" role="status">
          Asking OpenStreetMap (the public Overpass server) for the roads of this area. This can take up to a minute.
        </p>
      )}
      {state.kind === "refused" && (
        <p className="refused" data-testid="area-refused" role="alert">
          Not imported. {state.message}
        </p>
      )}
    </div>
  );
}
