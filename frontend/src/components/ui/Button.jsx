import { buttonClass } from './styles';

/**
 * Button. See `buttonClass` in ./styles for why the class string is built
 * separately: most of the app's buttons are links, and they need the same
 * treatment without a polymorphic wrapper.
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button type={type} className={buttonClass({ variant, size, className })} {...rest}>
    {children}
  </button>
);

export default Button;
