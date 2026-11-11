export {
  SCENARIO_FORMAT_VERSION,
  baselineOf,
  createBaseline,
  createProposal,
  withChange,
  withoutChange,
  withRoadWidth,
} from "./scenario";
export type { Change, RoadWidthChange, Scenario } from "./scenario";
export { resolveScenario } from "./resolve";
export { ESTIMATE_LABEL, MEASURES, compareResults, formatChange } from "./comparison";
export type { ComparedMeasure, Measure } from "./comparison";
