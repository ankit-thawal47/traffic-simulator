import { buildLayout, defaultBlock } from "@traffic-simulator/scenario";
import { describe, expect, it } from "vitest";
import { EXAMPLES } from "./examples";
import { roadName, roadNamesFor } from "./road-names";

const hebbal = EXAMPLES.find((example) => example.id === "hebbal-city-bound")!.scenario;
const signalJunction = EXAMPLES.find((example) => example.id === "signal-junction")!.scenario;
const layout = { blocks: [defaultBlock("straight"), defaultBlock("t-junction"), defaultBlock("flyover")] };

describe("the names a planner reads for roads", () => {
  it("uses a prepared corridor's own names", () => {
    const names = roadNamesFor(hebbal);
    expect(roadName(names, "hebbal-flyover")).toBe("Hebbal flyover");
    expect(roadName(names, "krpuram-in")).toBe("Outer Ring Road from K.R. Puram");
  });

  it("names each road of a built network by its block and where it runs", () => {
    const names = roadNamesFor({ layout });
    expect(roadName(names, "b1-eastbound")).toBe("Block 1 (straight road): eastbound");
    expect(roadName(names, "b2-eastbound-in")).toBe("Block 2 (T-junction): eastbound, approaching the junction");
    expect(roadName(names, "b2-westbound-out")).toBe("Block 2 (T-junction): westbound, leaving the junction");
    expect(roadName(names, "b2-south-in")).toBe("Block 2 (T-junction): side road from the south");
    expect(roadName(names, "b2-south-out")).toBe("Block 2 (T-junction): side road to the south");
    expect(roadName(names, "b3-eastbound-flyover")).toBe("Block 3 (flyover): eastbound flyover");
    expect(roadName(names, "b3-westbound-entry")).toBe("Block 3 (flyover): westbound, before the flyover");
    expect(roadName(names, "b3-westbound-exit")).toBe("Block 3 (flyover): westbound, after the flyover");
    expect(roadName(names, "b3-eastbound-in")).toBe("Block 3 (flyover): eastbound beneath the flyover, approaching the junction");
  });

  it("gives every road of a built network a name of its own", () => {
    const built = buildLayout(layout);
    if (!built.ok) throw new Error(built.message);
    const names = roadNamesFor({ layout });
    const shown = built.value.network.roads.map((road) => roadName(names, road.id));
    expect(shown.every((name) => !/^b\d/.test(name))).toBe(true);
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("names an example's compass roads in words", () => {
    const names = roadNamesFor(signalJunction);
    expect(roadName(names, "north-in")).toBe("From the north");
    expect(roadName(names, "west-out")).toBe("Towards the west");
  });

  it("falls back to the road's own identifier when it has no name", () => {
    expect(roadName(roadNamesFor({}), "main")).toBe("main");
  });
});
