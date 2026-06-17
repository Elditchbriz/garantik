import React from 'react';

export default function Icon({ name, className = '', style = {} }) {
  return (
    <svg className={`icon ${className}`} style={style}>
      <use href={`#ic-${name}`} xlinkHref={`#ic-${name}`} />
    </svg>
  );
}
