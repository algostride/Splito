import { useLocation } from 'react-router-dom';
import { useEnterOnce } from '../../hooks/useEnterOnce';

/**
 * The frame every page renders into: gutter padding, the max-width column, and
 * the entrance animation.
 *
 * There is deliberately no `header` slot. The group's sticky header and tab
 * bar live in the GroupDetail layout route instead, outside this component,
 * because the entrance animation is a fade on whatever it wraps. A header
 * inside here would be dragged through opacity 0 every time a tab animated in,
 * which is the flicker this whole arrangement exists to avoid.
 */
const Screen = ({ children, width = 'max-w-[1360px]', className = '' }) => {
  const { pathname } = useLocation();
  const entering = useEnterOnce(pathname);

  return (
    <div
      className={[
        'anim-screen flex-1 min-w-0 flex flex-col',
        entering ? '' : 'is-settled',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="anim-screen-body flex-1">
        {/* `width` replaces the default rather than being appended to it. Two
            max-width utilities in one class attribute do not resolve in
            class-attribute order, they resolve in stylesheet order, so an
            appended override would win or lose unpredictably. */}
        <div
          className={['p-gutter space-y-gutter mx-auto w-full', width, className]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Screen;
