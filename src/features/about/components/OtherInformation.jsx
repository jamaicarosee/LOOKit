
import React, { useState } from 'react';
import { BookOpen, CodeXml, Mail } from 'lucide-react';
import AccordionItem from './AccordionItem';
import { useViewport } from '../../dashboard/hooks/useViewport';
import {
  HOW_TO_USE,
  DEVELOPERS_TEXT,
  TEAM,
  CONTACT_TEXT,
  CONTACT_EMAIL,
  FEEDBACK_TEXT,
  FEEDBACK_LINK,
} from '../aboutContent';

export default function OtherInformation() {
  const [openId, setOpenId] = useState(null);
  const { isDesktop } = useViewport(1024);

  const toggle = (id) =>
    setOpenId((cur) => (cur === id ? null : id));

  // Email link based on desktop or mobile view
  const emailLink = isDesktop
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}`
    : `mailto:${CONTACT_EMAIL}`;

  return (
    <section>
      <h3 className="text-sm lg:text-xl font-semibold text-[#0B2545] mb-2 lg:mb-4">
        Other Information
      </h3>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">

        {/* HOW TO USE */}
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
                <p className="font-bold text-[#0B2545]">
                  {i + 1}. {s.title}
                </p>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </AccordionItem>

        {/* MEET THE DEVELOPERS */}
        <AccordionItem
          id="devs"
          icon={CodeXml}
          title="Meet the Developers"
          isOpen={openId === 'devs'}
          onToggle={() => toggle('devs')}
        >
          <p className="text-center">
            {DEVELOPERS_TEXT}
          </p>

          <p className="text-center font-bold text-[#0B2545] mt-3">
            The LOOKit Team
          </p>

          <ul className="mt-1 text-center font-medium text-[#0B2545] space-y-0.5">
            {TEAM.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </AccordionItem>

        {/* CONTACT US */}
        <AccordionItem
          id="contact"
          icon={Mail}
          title="Contact Us"
          isOpen={openId === 'contact'}
          onToggle={() => toggle('contact')}
          last
        >
          {/* CONTACT DESCRIPTION */}
          <p className="text-center">
            {CONTACT_TEXT}
          </p>

          {/* EMAIL ADDRESS */}
          <div className="mt-3 flex justify-center">
            <a
              href={emailLink}
              target={isDesktop ? '_blank' : undefined}
              rel={isDesktop ? 'noopener noreferrer' : undefined}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 inline-block cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-800"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* FEEDBACK SECTION */}
          <div className="mt-6 text-center">
            <p>
              {FEEDBACK_TEXT}
            </p>

            <p className="mt-3">
              <a
                href={FEEDBACK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline underline-offset-2 break-all select-text"
              >
                {FEEDBACK_LINK}
              </a>
            </p>
          </div>

        </AccordionItem>

      </div>
    </section>
  );
}