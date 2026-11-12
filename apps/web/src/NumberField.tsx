import { useState } from "react";

/**
 * A number the planner types, for a change control. What is typed is kept as
 * text, and is passed on only once it is a number in range (a whole one, if
 * asked): half-typed figures never become a change. Whether the engine will
 * run the result is for whoever receives onCommit to check.
 */
export function NumberField({
  label,
  testId,
  value,
  min,
  max,
  step = 1,
  whole = false,
  disabled = false,
  onCommit,
}: {
  label: string;
  testId: string;
  /** The figure the proposal has now. */
  value: number;
  min: number;
  max: number;
  step?: number;
  whole?: boolean;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [typed, setTyped] = useState<string>();
  const usable = (text: string): number | undefined => {
    const number = Number(text);
    const fits = text.trim() !== "" && number >= min && number <= max && (!whole || Number.isInteger(number));
    return fits ? number : undefined;
  };
  // At most three decimal places, so a figure worked out from others never shows a long tail.
  const text = typed ?? String(Math.round(value * 1000) / 1000);

  return (
    <label>
      {label}
      <input
        data-testid={testId}
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        disabled={disabled}
        aria-invalid={usable(text) === undefined}
        onChange={(event) => {
          const next = event.target.value;
          const number = usable(next);
          if (number !== undefined) {
            setTyped(undefined);
            onCommit(number);
          } else {
            setTyped(next);
          }
        }}
        onBlur={() => setTyped(undefined)}
      />
    </label>
  );
}
