import { listAssumptions, NOT_MODELLED } from "@traffic-simulator/engine";
import { useMemo, useRef } from "react";
import "./assumptions-panel.css";
import { formatAssumptionValue, STATES, STATE_TEXT } from "./assumptions-text";

/**
 * The assumptions panel (user stories 52 and 53): every assumption the engine
 * uses, with its value, unit, state and source, and the list of what is not
 * modelled. It reads the engine's own table and changes nothing.
 */
export function AssumptionsPanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = useMemo(listAssumptions, []);

  return (
    <>
      <button type="button" data-testid="open-assumptions" onClick={() => dialog.current?.showModal()}>
        Assumptions and what is not modelled
      </button>
      <dialog ref={dialog} className="assumptions" data-testid="assumptions-panel" aria-labelledby="assumptions-title">
        <header>
          <h2 id="assumptions-title">Assumptions and what is not modelled</h2>
          <button type="button" data-testid="close-assumptions" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>

        <div className="assumptions-body">
          <p>
            These are the values and rules the engine runs with, read from the engine itself. They cannot be changed
            here. Every result is an uncalibrated estimate: the engine has not been fitted to, or checked against,
            measured traffic on any road.
          </p>
          <dl className="assumption-states" data-testid="assumption-states">
            {STATES.map((state) => (
              <div key={state}>
                <dt>
                  <span className={`state state-${state}`}>{STATE_TEXT[state].label}</span>
                </dt>
                <dd>{STATE_TEXT[state].meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="hint">
            "Confirmed in the source" says only that the figure is the one printed there. Most sources measured or
            fitted their figures in Chennai, not on the road in a scenario.
          </p>

          {groups.map((group) => (
            <section key={group.id} data-testid={`assumptions-${group.id}`}>
              <h3>{group.title}</h3>
              {group.about && <p className="hint">{group.about}</p>}
              <table>
                <thead>
                  <tr>
                    <th scope="col">Assumption</th>
                    <th scope="col">Value</th>
                    <th scope="col">State</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {group.assumptions.map((assumption) => (
                    <tr key={assumption.id} data-testid={`assumption-${assumption.id}`} data-state={assumption.state}>
                      <th scope="row">{assumption.name}</th>
                      <td className="value" data-testid="value">
                        {formatAssumptionValue(assumption)}
                      </td>
                      <td>
                        <span className={`state state-${assumption.state}`} data-testid="state">
                          {STATE_TEXT[assumption.state].label}
                        </span>
                      </td>
                      <td className="source">
                        <span data-testid="source">{assumption.source}</span>
                        {assumption.note && <span className="note"> {assumption.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          <section data-testid="not-modelled">
            <h3>Not modelled</h3>
            <p className="hint">What the engine leaves out. An estimate says nothing about these.</p>
            <dl className="not-modelled">
              {NOT_MODELLED.map((item) => (
                <div key={item.name}>
                  <dt>{item.name}</dt>
                  <dd>{item.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </dialog>
    </>
  );
}
