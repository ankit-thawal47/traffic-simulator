import { describe, expect, it } from "vitest";
import { createSharedCamera, type CameraPose } from "./shared-camera";

const overhead: CameraPose = { position: [0, 300, 0], target: [0, 0, 0] };
const fromTheSouth: CameraPose = { position: [0, 60, 200], target: [20, 0, 0] };

describe("one camera shared by several views", () => {
  it("when one view moves the camera, every other view is told where it now is", () => {
    const camera = createSharedCamera();
    const seenByBaseline: CameraPose[] = [];
    const seenByProposal: CameraPose[] = [];
    camera.join("baseline", (pose) => seenByBaseline.push(pose));
    camera.join("proposal", (pose) => seenByProposal.push(pose));

    camera.move("baseline", overhead);

    expect(seenByProposal).toEqual([overhead]);
    // The view that moved it already shows it; it is not told again.
    expect(seenByBaseline).toEqual([]);

    camera.move("proposal", fromTheSouth);

    expect(seenByBaseline).toEqual([fromTheSouth]);
    expect(seenByProposal).toEqual([overhead]);
  });

  it("a view that joins later starts where the camera already is", () => {
    const camera = createSharedCamera();
    camera.join("baseline", () => {});
    camera.move("baseline", overhead);

    const seenByProposal: CameraPose[] = [];
    camera.join("proposal", (pose) => seenByProposal.push(pose));

    expect(seenByProposal).toEqual([overhead]);
  });

  it("a view that has left is no longer told", () => {
    const camera = createSharedCamera();
    const seenByProposal: CameraPose[] = [];
    const leave = camera.join("proposal", (pose) => seenByProposal.push(pose));

    leave();
    camera.move("baseline", overhead);

    expect(seenByProposal).toEqual([]);
  });
});
