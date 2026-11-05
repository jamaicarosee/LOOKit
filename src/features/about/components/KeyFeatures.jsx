import React from 'react';
import { KEY_FEATURES } from '../aboutContent';

export default function KeyFeatures() {
  return (
    <section>
      <h3 className="text-sm lg:text-xl font-semibold text-[#0B1E36] mb-2 lg:mb-4">Key Features</h3>
      <ul className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {KEY_FEATURES.map(({ id, icon: Icon, title, desc }) => (
          <li key={id} className="flex items-center gap-3 lg:gap-5 px-4 py-3 lg:px-7 lg:py-6">
            <Icon className="w-4 h-4 lg:w-7 lg:h-7 shrink-0 text-[#0B1E36] stroke-[2]" />
            <div className="min-w-0">
              <p className="text-xs lg:text-lg font-semibold text-[#0B1E36]">{title}</p>
              <p className="text-[11px] lg:text-sm lg:mt-0.5 text-slate-500">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
