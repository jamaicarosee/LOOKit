import React, { useState } from 'react';
import { BookOpen, CodeXml, Mail } from 'lucide-react';
import AccordionItem from './AccordionItem';
import {
  HOW_TO_USE, DEVELOPERS_TEXT, TEAM, CONTACT_TEXT, CONTACT_EMAIL,
} from '../aboutContent';

export default function OtherInformation() {
  // One panel open at a time, matching the Figma states
  const [openId, setOpenId] = useState(null);
  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <section>
      <h3 className="text-sm lg:text-xl font-semibold text-[#0B1E36] mb-2 lg:mb-4">Other Information</h3>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <AccordionItem
          id="how"
          icon={BookOpen}
          title={<>How to Use <b className="font-black">LOOKit</b></>}
          isOpen={openId === 'how'}
          onToggle={() => toggle('how')}
        >
          <ol className="space-y-2.5">
            {HOW_TO_USE.map((s, i) => (
              <li key={s.title}>
                <p className="font-bold text-[#0B1E36]">{i + 1}. {s.title}</p>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </AccordionItem>

        <AccordionItem
          id="devs"
          icon={CodeXml}
          title="Meet the Developers"
          isOpen={openId === 'devs'}
          onToggle={() => toggle('devs')}
        >
          <p className="text-center">{DEVELOPERS_TEXT}</p>
          <p className="text-center font-bold text-[#0B1E36] mt-3">The LOOKit Team</p>
          <ul className="mt-1 text-center font-medium text-[#0B1E36] space-y-0.5">
            {TEAM.map((n) => <li key={n}> {n}</li>)}
          </ul>
        </AccordionItem>

        <AccordionItem
          id="contact"
          icon={Mail}
          title="Contact Us"
          isOpen={openId === 'contact'}
          onToggle={() => toggle('contact')}
          last
        >
          <p className="text-center">{CONTACT_TEXT}</p>
          <p className="text-center mt-3">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-blue-600 underline underline-offset-2 break-all select-text"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </AccordionItem>
      </div>
    </section>
  );
}
