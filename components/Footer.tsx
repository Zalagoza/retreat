import { DEVELOPER_URL, WA_LINK } from '@/lib/config';

export default function Footer() {
  return (
    <footer className="mt-8 border-t-4 border-rast-gold bg-rast-charcoal">
      <div className="mx-auto max-w-[1400px] space-y-2 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-sm text-neutral-400">
        <p>&copy; {new Date().getFullYear()} KIA Immigration Men&apos;s Welfare Retreat. All rights reserved.</p>
        <p>
          Roots of{' '}
          <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer" className="text-rast-gold underline">
            Wathu Digital Creations
          </a>
        </p>
        <p className="flex justify-center gap-5">
          <a href="/about" className="py-1 hover:text-rast-gold">About Us</a>
          <a href="/help" className="py-1 hover:text-rast-gold">Help</a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="py-1 hover:text-rast-gold">Contact</a>
        </p>
      </div>
    </footer>
  );
}
