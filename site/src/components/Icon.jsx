import { I } from '../lib/icons.js';

// Inline stroke icon. `cls` adds size/colour classes (i12, i20, i24, subtle…).
export function Icon({ name, cls = '', style }) {
  return (
    <svg className={'ico' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      <path d={I[name]} />
    </svg>
  );
}

// External link that opens in a new tab.
export function Ext({ href, className, children, ...rest }) {
  return <a className={className} href={href} target="_blank" rel="noopener" {...rest}>{children}</a>;
}
