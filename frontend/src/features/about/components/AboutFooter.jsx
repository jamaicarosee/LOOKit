import React from 'react';
import { FOOTER_TEXT, FOOTER_SUB } from '../aboutContent';

export default function AboutFooter() {
  return (
    <p className="text-center text-[10px] lg:text-xs leading-relaxed text-slate-400 pt-2 pb-1">
      {FOOTER_TEXT}<br />{FOOTER_SUB}
    </p>
  );
}
