import type { Network } from "../src/index";
import { fourWay, type FourWayOptions } from "./four-way";

/**
 * A priority junction shaped like a T, in left-hand traffic: the main road
 * runs east-west ("west-in" towards the east on the north half, "east-in"
 * towards the west on the south half) and the side road comes from the south
 * ("south-in"). Built from fourWay() without its north arm, so the roads and
 * the junction's centre are the same: stop lines 15 m from the centre,
 * approaches 200 m long and 7 m wide unless the options say otherwise.
 */
export function tJunction(options: FourWayOptions = {}): Network {
  const cross = fourWay(options);
  const roads = cross.roads.filter((road) => !road.id.startsWith("north"));
  const connections = cross.junctions![0]!.connections.filter(
    (connection) => !connection.fromRoadId.startsWith("north") && !connection.toRoadId.startsWith("north"),
  );
  return {
    formatVersion: 5,
    roads,
    junctions: [{ id: "tee", control: "priority", mainRoadIds: ["west-in", "east-in"], connections }],
  };
}
