/**
 * The names a planner reads for roads, in place of their identifiers
 * ("hebbal-flyover", "b2-eastbound-in"). A prepared corridor brings its own
 * names; a built network's roads are named from the block they belong to and
 * where they run; an example's compass roads ("north-in") are said in words.
 * A road with none of these is shown by its identifier.
 */
import { corridorById, type BuildingBlockKind, type Layout } from "@traffic-simulator/scenario";

export type RoadNames = Readonly<Record<string, string>>;

const BLOCK_KIND_NAMES: Record<BuildingBlockKind, string> = {
  straight: "straight road",
  "t-junction": "T-junction",
  "four-way": "four-way junction",
  flyover: "flyover",
};

const COMPASS = ["north", "south", "east", "west"];

/** Where a road of a built block runs, from the last part of its identifier. */
function builtPart(kind: BuildingBlockKind, rest: string): string | undefined {
  if (rest === "eastbound" || rest === "westbound") return rest;
  const carriageway = /^(eastbound|westbound)-(in|out|entry|exit|flyover)$/.exec(rest);
  if (carriageway) {
    const [, direction, part] = carriageway;
    if (part === "flyover") return `${direction} flyover`;
    if (part === "entry") return `${direction}, before the flyover`;
    if (part === "exit") return `${direction}, after the flyover`;
    const beneath = kind === "flyover" ? " beneath the flyover" : "";
    return `${direction}${beneath}, ${part === "in" ? "approaching" : "leaving"} the junction`;
  }
  const side = /^(north|south)-(in|out)$/.exec(rest);
  if (side) return `side road ${side[2] === "in" ? "from" : "to"} the ${side[1]}`;
  return undefined;
}

function compassName(id: string): string | undefined {
  const match = /^([a-z]+)-(in|out)$/.exec(id);
  if (!match || !COMPASS.includes(match[1]!)) return undefined;
  return match[2] === "in" ? `From the ${match[1]}` : `Towards the ${match[1]}`;
}

/** The names for the roads of a scenario's network, as far as it has any. */
export function roadNamesFor(scenario: { corridorId?: string; layout?: Layout }): RoadNames {
  const corridor = scenario.corridorId === undefined ? undefined : corridorById(scenario.corridorId);
  if (corridor) return corridor.roadNames;
  const names: Record<string, string> = {};
  if (scenario.layout) {
    // Built roads are named "b<block number>-<where it runs>"; see the builder.
    for (const [index, block] of scenario.layout.blocks.entries()) {
      const prefix = `b${index + 1}-`;
      const label = `Block ${index + 1} (${BLOCK_KIND_NAMES[block.kind]})`;
      for (const rest of [
        "eastbound",
        "westbound",
        ...["eastbound", "westbound"].flatMap((direction) =>
          ["in", "out", "entry", "exit", "flyover"].map((part) => `${direction}-${part}`),
        ),
        "north-in",
        "north-out",
        "south-in",
        "south-out",
      ]) {
        const part = builtPart(block.kind, rest);
        if (part) names[prefix + rest] = `${label}: ${part}`;
      }
    }
  }
  return names;
}

/** The name to show for a road. */
export function roadName(names: RoadNames, roadId: string): string {
  if (Object.prototype.hasOwnProperty.call(names, roadId)) return names[roadId]!;
  return compassName(roadId) ?? roadId;
}
