import { changeTarget, describeChange, withoutChange } from "@traffic-simulator/scenario";
import type { ChangeControlProps } from "./RoadChanges";

/** The list of changes that make up the proposal, each in plain words, each with its own undo. */
export function ChangesList({ proposal, onChange }: ChangeControlProps) {
  if (proposal.changes.length === 0) {
    return (
      <p className="hint" data-testid="no-changes">
        None. The proposal is a copy of the baseline.
      </p>
    );
  }
  return (
    <ol data-testid="changes">
      {proposal.changes.map((change, index) => (
        <li key={changeTarget(change)} data-change-kind={change.kind}>
          {describeChange(change, proposal)}{" "}
          <button type="button" data-testid="undo-change" onClick={() => onChange(withoutChange(proposal, index))}>
            Undo
          </button>
        </li>
      ))}
    </ol>
  );
}
