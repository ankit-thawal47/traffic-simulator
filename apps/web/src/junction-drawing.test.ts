import { describe, expect, it } from "vitest";
import { createRun } from "@traffic-simulator/engine";
import { resolveScenario } from "@traffic-simulator/scenario";
import * as THREE from "three";
import { EXAMPLES } from "./examples";
import { createJunctionDrawing } from "./junction-drawing";

const priority = EXAMPLES.find((example) => example.id === "priority-junction");

describe("the priority junction example", () => {
  it("is offered among the examples, and runs", () => {
    expect(priority).toBeDefined();
    expect(priority!.scenario.network.junctions![0]!.control).toBe("priority");
    const run = createRun(resolveScenario(priority!.scenario));
    for (let i = 0; i < 50; i++) run.step();
    expect(run.results().vehiclesEntered).toBeGreaterThan(0);
  });

  it("is drawn with no signal lamps, and with a give-way marking on its side road only", () => {
    const drawing = createJunctionDrawing(priority!.scenario.network, new THREE.MeshBasicMaterial());
    expect(drawing.showSignals(0)).toBe("");
    const giveWay = drawing.objects.filter((object) => object.name.startsWith("give-way:")).map((object) => object.name);
    expect(new Set(giveWay)).toEqual(new Set(["give-way:south-in"]));
    drawing.dispose();
  });
});
