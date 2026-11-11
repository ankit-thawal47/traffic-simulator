import { ESTIMATE_LABEL, acrossSeeds, compareAcrossSeeds, formatChange } from "@traffic-simulator/scenario";
import { collectedResults, type FiveSeeds } from "./five-seeds";
import { completenessNote, formatAcrossSeeds, formatClock, formatTime } from "./results-text";

/** What one seed is doing, in a few words. */
function seedStatus(collected: FiveSeeds, seedIndex: number): string {
  if (collected.results[seedIndex]) return "finished";
  if (seedIndex === 0) return collected.watched ? formatClock(collected.watched, collected.plan) : "starting";
  const fraction = collected.fractions[seedIndex] ?? 0;
  return fraction > 0 ? `${Math.round(fraction * 100)}%` : "waiting its turn";
}

/**
 * The results area: progress across the seeds, how complete the figures are,
 * and the fixed result set (ADR 0005) for baseline and proposal as the average
 * and range across seeds, with the change from the baseline.
 */
export function ResultsPanel({ collected }: { collected: FiveSeeds }) {
  const { plan } = collected;
  const results = collectedResults(collected);
  const rows = compareAcrossSeeds(results.baseline, results.proposal);
  const waiting = {
    baseline: acrossSeeds(results.baseline.map((seed) => seed.vehiclesWaitingToEnter)),
    proposal: acrossSeeds(results.proposal.map((seed) => seed.vehiclesWaitingToEnter)),
  };
  const someWaiting = (waiting.baseline.highest ?? 0) > 0 || (waiting.proposal.highest ?? 0) > 0;

  return (
    <section className="results" aria-label="Results">
      <h2>Results</h2>

      <div className="seeds" data-testid="seeds" data-seeds-finished={results.seedsFinished}>
        <label>
          Seeds finished: <span data-testid="seeds-finished">{results.seedsFinished}</span> of {results.seeds}{" "}
          <progress data-testid="seeds-progress" value={results.progress} max={1} />
        </label>
        <ol>
          {collected.results.map((_, seedIndex) => (
            <li key={seedIndex} data-testid={`seed-${seedIndex + 1}`}>
              {seedIndex === 0 ? "The run you are watching" : "Unseen"}: {seedStatus(collected, seedIndex)}
            </li>
          ))}
        </ol>
        <p className={results.partial ? "partial" : "complete"} data-testid="completeness" role="status">
          {completenessNote(
            { ...results, firstSeedFinished: collected.results[0] !== undefined },
            collected.watched,
            plan,
          )}
        </p>
      </div>

      <table data-testid="results">
        <caption>
          {ESTIMATE_LABEL}. Each figure is for one simulated hour ({formatTime(plan.measuredS)}) after a warm-up of{" "}
          {formatTime(plan.warmUpS)} that is left out: the average across seeds, then the range from the lowest seed to
          the highest. The change is between the averages.
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

      {results.seedsFinished > 0 && (
        <p className="note" data-testid="waiting-to-enter">
          Vehicles still waiting to enter when the hour ended: baseline {formatAcrossSeeds(waiting.baseline)}, proposal{" "}
          {formatAcrossSeeds(waiting.proposal)}.
          {someWaiting &&
            " Vehicles are left waiting when more traffic arrives than the road can take in, so fewer vehicles got through than the demand sent."}
        </p>
      )}
    </section>
  );
}
