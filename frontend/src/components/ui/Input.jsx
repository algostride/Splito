import { useId } from 'react';
import { inputClass } from './styles';

/**
 * Text input, and the label/hint/error wrapper around it.
 *
 * The app had three different input treatments (Dashboard's create-group
 * modal and GroupDetail's invite box disagreed on radius and focus ring), so
 * both the control and its wrapper live here now.
 *
 * A number input gets `no-number-spinner` here rather than at each call site.
 * The browser's up/down arrows were on all four number fields in the app and on
 * none of them deliberately; one field had the class and three did not, which
 * is how they ended up inconsistent. Turning the arrows off centrally means a
 * new number input cannot reintroduce them, and a caller that *wants* stepping
 * can still add its own control alongside.
 */

const Input = ({ className = '', invalid = false, inset = 'none', size = 'md', ...rest }) => (
  <input
    className={inputClass({
      className: [rest.type === 'number' ? 'no-number-spinner' : '', className]
        .filter(Boolean)
        .join(' '),
      invalid,
      inset,
      size,
    })}
    {...rest}
  />
);

export const Textarea = ({ className = '', invalid = false, inset = 'none', rows = 3, ...rest }) => (
  <textarea
    rows={rows}
    className={[inputClass({ invalid, inset }), 'h-auto py-3 leading-relaxed', className]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  />
);

/**
 * A native select, styled from the same control class as Input.
 *
 * It exists because the settle-up dialog needed a dropdown, and passing
 * `as="select"` to Field would otherwise render a bare, unstyled <select>.
 * Appearance is left to the platform: a custom chevron on a native select
 * means having to fake the popup, which is not worth it.
 */
export const Select = ({ className = '', invalid = false, inset = 'none', children, ...rest }) => (
  <select
    className={[inputClass({ invalid, inset }), 'pr-10', className].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
  </select>
);

/**
 * Label + control + optional hint or error.
 *
 * The control is rendered here rather than passed in as children, so the
 * generated id and the `aria-describedby` pointing at the hint or error are
 * always attached to it. Taking children instead meant a call site could
 * silently drop the description and leave the message unread by a screen
 * reader.
 *
 * `leading` places a glyph inside the control's box. It exists because a field
 * with a leading icon needs a positioned wrapper *around* the input, which a
 * call site cannot express without passing children. It also picks the input
 * inset to match, so the two cannot drift apart.
 */
export const Field = (props) => {
  // Destructure here, not in the parameter list: no-unused-vars'
  // varsIgnorePattern covers variable declarations only, so an
  // `as: Control = Input` parameter is reported unused. See the note in
  // eslint.config.js about the capitalised-identifier exemption.
  const {
    label,
    hint,
    error,
    as: Control = Input,
    leading = null,
    inset,
    className = '',
    id: idProp,
    ...rest
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const resolvedInset = inset ?? (leading ? 'icon' : 'none');

  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      {label ? (
        <label htmlFor={id} className="text-meta font-semibold text-muted">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none flex items-center"
            aria-hidden="true"
          >
            {leading}
          </span>
        ) : null}
        <Control
          id={id}
          inset={resolvedInset}
          aria-describedby={describedBy}
          invalid={!!error}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-meta text-neg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-meta text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Input;

