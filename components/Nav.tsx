'use client';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { WA_LINK } from '@/lib/config';

const links = [
  { href: '/about', label: 'About Us', external: false },
  { href: WA_LINK, label: 'Contact Me', external: true },
  { href: '/admin', label: 'Admin log in', external: false },
  { href: '/help', label: 'Help', external: false },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const item = 'block px-3 py-3 text-sm hover:text-rast-gold sm:py-2';
  return (
    <nav className="fixed left-0 top-0 z-40 w-full border-b-4 border-rast-gold bg-rast-charcoal pt-safe">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        <a href="/" className="text-lg font-bold text-rast-gold">KIA MEMOIRS</a>
        <ul className="hidden items-center gap-2 sm:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.href} className={item} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <button onClick={() => setOpen((v) => !v)} className="p-2 sm:hidden" aria-label="Menu" aria-expanded={open}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <ul className="border-t border-neutral-700 bg-rast-charcoal pb-2 sm:hidden">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className={item + ' pl-4'}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
