export {
  SCENARIO_FORMAT_VERSION,
  baselineOf,
  createBaseline,
  createProposal,
  lanesOf,
  withChange,
  withoutChange,
  withRoadLanes,
  withRoadWidth,
} from "./scenario";
export type { Change, RoadLanesChange, RoadWidthChange, Scenario } from "./scenario";
export { resolveScenario } from "./resolve";
export { ESTIMATE_LABEL, MEASURES, compareResults, formatChange } from "./comparison";
export type { ComparedMeasure, Measure } from "./comparison";
