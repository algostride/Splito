import { avatarSize, avatarTone, initials } from './styles';

/** Two-letter initials on a stable per-name tone. */
const Avatar = ({ name = '', size = 'md', className = '', ...rest }) => (
  <div
    aria-hidden="true"
    className={[
      avatarSize(size),
      'rounded-full flex items-center justify-center font-bold shrink-0',
      avatarTone(name),
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {initials(name)}
  </div>
);

export default Avatar;
