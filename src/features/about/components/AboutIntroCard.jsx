import React from 'react';
import { Info } from 'lucide-react';
import { ABOUT_TEXT } from '../aboutContent';

export default function AboutIntroCard() {
  return (
    <section className="rounded-2xl bg-[#E5EEF7] px-4 py-4 lg:px-8 lg:py-7 text-[#0B1E36]">
      <h2 className="flex items-center gap-2 lg:gap-3 text-base lg:text-2xl font-semibold">
        <Info className="w-4 h-4 lg:w-6 lg:h-6 stroke-[2]" />
        About <span className="font-black">LOOKit</span>
      </h2>
      <p className="mt-2 lg:mt-4 text-xs lg:text-base leading-relaxed text-justify text-slate-700">{ABOUT_TEXT}</p>
    </section>
  );
}
