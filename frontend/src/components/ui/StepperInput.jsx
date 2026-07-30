/**
 * A number input with its own minus and plus buttons.
 *
 * Extracted from the split grid, which hand-rolled this: a native number input
 * with `-webkit-appearance` arrows suppressed, and two absolutely-positioned
 * buttons laid over the left and right edges. That markup is 40 lines inside a
 * bills component, and the one thing the app most obviously needed elsewhere was
 * a way to turn a number input into a stepper without repeating it.
 *
 * Why the native arrows are hidden even where stepping is offered: two
 * spinners on one input is one too many, and the browser's arrows are invisible
 * until hover, sit in the padding a design does not control, and are not
 * keyboard-reachable in a predictable place. The buttons here are labelled, so
 * a screen reader announces what they do and for whom.
 *
 * Rounding is done by the caller's step rather than here: this component only
 * adds and subtracts, so the mode's precision rules stay in billUtils with the
 * rest of the split arithmetic.
 *
 * Clicks never propagate. The split grid renders each member as a clickable
 * row that toggles their inclusion, so a stepper that let its clicks through
 * would add a fraction to someone and simultaneously exclude them. Making that
 * a fixed behaviour rather than a prop is the point: a control embedded in a
 * clickable row should not be a way to click the row.
 */

const StepperInput = ({
  value,
  onChange,
  min = 0,
  step = 1,
  precision = 6,
  disabled = false,
  decrementLabel,
  incrementLabel,
  className = '',
  inputClassName = '',
  placeholder,
}) => {
  const current = parseFloat(value);
  const base = Number.isNaN(current) ? min : current;
  /* Rounded to the caller's precision, because a stepper is where float noise
     is born: 0.1 + 0.1 is 0.30000000000000004, and a shares field stepping in
     tenths has to land on exactly one decimal. The caller supplies the number so
     the rule stays with the mode's other constants rather than being guessed
     here. */
  const clamp = (next) => Math.max(min, Number(next.toFixed(precision)));

  // min and step are read at click time rather than captured, so a caller that
  // changes mode (shares <-> percent) steps with the new numbers without the
  // buttons needing to be remounted.
  const stepBy = (dir) => onChange(String(clamp(base + dir * step)));

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          stepBy(-1);
        }}
        aria-label={decrementLabel}
        className={`absolute left-0 h-full w-6 flex items-center justify-center text-sm font-black leading-none transition-colors ${
          disabled ? 'text-faint' : 'text-muted hover:text-text'
        }`}
      >
        &minus;
      </button>
      <input
        type="number"
        value={value}
        disabled={disabled}
        min={min}
        step={step}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        className={`no-number-spinner w-full min-w-0 h-8 text-center pl-7 pr-7 border rounded-control ${
          inputClassName
        }`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          stepBy(1);
        }}
        aria-label={incrementLabel}
        className={`absolute right-0 h-full w-6 flex items-center justify-center text-sm font-black leading-none transition-colors ${
          disabled ? 'text-faint' : 'text-muted hover:text-text'
        }`}
      >
        +
      </button>
    </div>
  );
};

export default StepperInput;
