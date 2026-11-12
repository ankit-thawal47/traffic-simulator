import {
  ESTIMATE_LABEL,
  SMALLEST_BASELINE_FOR_PERCENT,
  acrossSeeds,
  compareAcrossSeeds,
  formatChange,
  measuresFor,
} from "@traffic-simulator/scenario";
import type { Network } from "@traffic-simulator/engine";
import { collectedResults, type FiveSeeds } from "./five-seeds";
import { formatAcrossSeeds } from "./results-text";

/**
 * The results area: progress across the seeds, and the fixed result set
 * (ADR 0005) for baseline and proposal as the average and range across seeds,
 * with the change from the baseline.
 */
export function ResultsPanel({
  collected,
  networks,
  roadNames,
}: {
  collected: FiveSeeds;
  networks: readonly Network[];
  /** Names for a planner of the roads of a prepared corridor, whose ids come from OpenStreetMap. */
  roadNames?: Readonly<Record<string, string>>;
}) {
  const { plan } = collected;
  const results = collectedResults(collected);
  // The longest queue per approach is one row for each approach of a signal junction, in either network.
  const measures = measuresFor([...results.baseline, ...results.proposal], networks, roadNames);
  const rows = compareAcrossSeeds(results.baseline, results.proposal, measures);
  const waiting = {
    baseline: acrossSeeds(results.baseline.map((seed) => seed.vehiclesWaitingToEnter)),
    proposal: acrossSeeds(results.proposal.map((seed) => seed.vehiclesWaitingToEnter)),
  };
  const someWaiting = (waiting.baseline.highest ?? 0) > 0 || (waiting.proposal.highest ?? 0) > 0;

  return (
    <section className="results" aria-label="Results">
      <h2>Results</h2>

      <p className="seeds" data-testid="seeds" data-seeds-finished={results.seedsFinished} role="status">
        Seeds finished: <span data-testid="seeds-finished">{results.seedsFinished}</span> of {results.seeds}{" "}
        <progress data-testid="seeds-progress" value={results.progress} max={1} />
        {results.partial && <span data-testid="partial"> Figures are partial until all have finished.</span>}
      </p>

      <table data-testid="results">
        <caption>
          {ESTIMATE_LABEL}. One hour after a {plan.warmUpS / 60} minute warm-up; average and range (lowest to highest)
          over {results.seeds} seeds.
        </caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Baseline</th>
            <th scope="col">Proposal</th>
            <th scope="col">Change from baseline</th>
            <th scope="col">
              <span className="visually-hidden">Label</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={`result-${row.id}`}>
              <th scope="row">{row.name}</th>
              <td data-testid="baseline">{formatAcrossSeeds(row.baseline)}</td>
              <td data-testid="proposal">{formatAcrossSeeds(row.proposal)}</td>
              <td data-testid="change">
                {row.change === null ? "–" : formatChange(row.change)}
                {row.changePercent !== null && row.change !== 0 && (
                  <span className="percent"> ({formatChange(row.changePercent)}%)</span>
                )}
              </td>
              <td className="label">{row.estimateLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note" data-testid="percent-note">
        A change is also given as a percentage only when the baseline figure is at least{" "}
        {SMALLEST_BASELINE_FOR_PERCENT.s} s, {SMALLEST_BASELINE_FOR_PERCENT.m} m or{" "}
        {SMALLEST_BASELINE_FOR_PERCENT.vehicles} vehicles; against a smaller baseline a percentage misleads. Longest
        queues are given for the approaches of signal junctions.
      </p>

      {results.seedsFinished > 0 && (
        <p className="note" data-testid="waiting-to-enter">
          Still waiting to enter when the hour ended: baseline {formatAcrossSeeds(waiting.baseline)}, proposal{" "}
          {formatAcrossSeeds(waiting.proposal)} vehicles.
          {someWaiting && " More traffic arrived than the road could take in."}
        </p>
      )}
    </section>
  );
}
