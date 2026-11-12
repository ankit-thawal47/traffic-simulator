import {
  BLOCK_NAMES,
  BUILDING_BLOCK_KINDS,
  builtBaseline,
  defaultBlock,
  LAYOUT_LIMITS,
  withBlockAdded,
  withBlockMoved,
  withBlockSettings,
  withoutBlock,
  type BuildingBlock,
  type BuildingBlockKind,
  type Layout,
  type Scenario,
} from "@traffic-simulator/scenario";
import { useState } from "react";
import { NumberField } from "./NumberField";

/** The layout the builder starts with: one of each building block, west to east. */
const STARTING_LAYOUT: Layout = { blocks: BUILDING_BLOCK_KINDS.map((kind) => defaultBlock(kind)) };

/**
 * The builder: the planner assembles a network from building blocks in a
 * line along one main road, west to east, sets each block's lanes, width,
 * length, junction control and signal timing, and builds it. The built
 * network becomes the baseline. A layout that cannot run is refused with the
 * block and the reason, and nothing is opened.
 */
export function Builder({ from, onBuild }: { from: Layout | undefined; onBuild: (baseline: Scenario) => void }) {
  const [layout, setLayout] = useState<Layout>(from ?? STARTING_LAYOUT);
  const [adding, setAdding] = useState<BuildingBlockKind>("four-way");
  const [refusal, setRefusal] = useState<string>();
  const change = (next: Layout) => {
    setLayout(next);
    setRefusal(undefined);
  };
  const build = () => {
    const built = builtBaseline(layout);
    if (built.ok) onBuild(built.value);
    else setRefusal(built.message);
  };

  return (
    <div className="builder" data-testid="builder">
      <p className="hint">Blocks join in a line along one main road, from west (first) to east (last). Side roads meet the main road at junction blocks.</p>
      <ol className="builder-blocks">
        {layout.blocks.map((block, index) => (
          <li key={index} data-testid={`block-${index + 1}`}>
            <BlockSettings
              block={block}
              index={index}
              onChange={(settings) => change(withBlockSettings(layout, index, settings))}
            />
            <div className="builder-block-actions">
              <button type="button" data-testid={`block-${index + 1}-west`} disabled={index === 0} onClick={() => change(withBlockMoved(layout, index, -1))}>
                Move west
              </button>
              <button
                type="button"
                data-testid={`block-${index + 1}-east`}
                disabled={index === layout.blocks.length - 1}
                onClick={() => change(withBlockMoved(layout, index, 1))}
              >
                Move east
              </button>
              <button type="button" data-testid={`block-${index + 1}-remove`} onClick={() => change(withoutBlock(layout, index))}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="change-control">
        <label>
          Add a block at the east end
          <select data-testid="builder-add-kind" value={adding} onChange={(event) => setAdding(event.target.value as BuildingBlockKind)}>
            {BUILDING_BLOCK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {BLOCK_NAMES[kind]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" data-testid="builder-add" disabled={layout.blocks.length >= LAYOUT_LIMITS.blocks} onClick={() => change(withBlockAdded(layout, adding))}>
          Add
        </button>
        <button type="button" data-testid="builder-build" onClick={build}>
          Build and run as the baseline
        </button>
      </div>
      {refusal && (
        <p className="refused" data-testid="builder-refused" role="alert">
          Not built. {refusal}
        </p>
      )}
    </div>
  );
}

/** The settings of one block. Any figure in the field's range is taken; whether the layout can run is said on building. */
function BlockSettings({
  block,
  index,
  onChange,
}: {
  block: BuildingBlock;
  index: number;
  onChange: (settings: Parameters<typeof withBlockSettings>[2]) => void;
}) {
  const id = `block-${index + 1}`;
  return (
    <fieldset className="change-group">
      <legend>
        {index + 1}. {BLOCK_NAMES[block.kind]}
      </legend>
      <div className="change-control">
        <NumberField label="Lanes each way" testId={`${id}-lanes`} value={block.lanes} min={1} max={LAYOUT_LIMITS.lanes} whole onCommit={(lanes) => onChange({ lanes })} />
        <NumberField label="Width each way (m)" testId={`${id}-width`} value={block.widthM} min={0} max={60} step={0.5} onCommit={(widthM) => onChange({ widthM })} />
        <NumberField label="Length (m)" testId={`${id}-length`} value={block.lengthM} min={0} max={LAYOUT_LIMITS.lengthM} step={10} onCommit={(lengthM) => onChange({ lengthM })} />
      </div>
      {block.kind !== "straight" && (
        <div className="change-control">
          <label>
            Junction
            <select
              data-testid={`${id}-control`}
              value={block.control}
              onChange={(event) => onChange({ control: event.target.value === "priority" ? "priority" : "signal" })}
            >
              <option value="signal">Signal junction</option>
              <option value="priority">Priority junction (no signal)</option>
            </select>
          </label>
          <NumberField label="Side-road lanes each way" testId={`${id}-side-lanes`} value={block.sideLanes} min={1} max={LAYOUT_LIMITS.sideLanes} whole onCommit={(sideLanes) => onChange({ sideLanes })} />
          <NumberField label="Side-road width each way (m)" testId={`${id}-side-width`} value={block.sideWidthM} min={0} max={60} step={0.5} onCommit={(sideWidthM) => onChange({ sideWidthM })} />
          <NumberField label="Side-road length (m)" testId={`${id}-side-length`} value={block.sideLengthM} min={0} max={LAYOUT_LIMITS.sideLengthM.to} step={10} onCommit={(sideLengthM) => onChange({ sideLengthM })} />
          {block.control === "signal" && (
            <>
              <NumberField label="Main-road green (s)" testId={`${id}-main-green`} value={block.mainGreenS} min={1} max={600} onCommit={(mainGreenS) => onChange({ mainGreenS })} />
              <NumberField label="Side-road green (s)" testId={`${id}-side-green`} value={block.sideGreenS} min={1} max={600} onCommit={(sideGreenS) => onChange({ sideGreenS })} />
            </>
          )}
          {block.kind === "flyover" && <span className="hint">The median half of the main road's lanes rise onto the flyover; the rest go through the junction beneath.</span>}
        </div>
      )}
    </fieldset>
  );
}
