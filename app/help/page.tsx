import { WA_HELP_LINK } from '@/lib/config';

export const metadata = { title: 'Help' };

export default function Help() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4 leading-relaxed">
      <h1 className="text-2xl font-bold text-rast-gold">Help</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Download one photo</h2>
        <p>Tap the download icon in the corner of a photo, or open the photo and tap the download icon at the top. You get the full-size original.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Download many photos at once (batch download)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tap <strong>Select</strong> above the photos.</li>
          <li>Tap each photo you want. A gold tick shows it is chosen. <strong>Select all</strong> picks the photos loaded so far.</li>
          <li>Tap <strong>Download ZIP</strong> at the bottom of the screen.</li>
          <li>Your phone saves one ZIP file containing all the chosen photos in full size. Open it from your Downloads folder or Files app.</li>
        </ol>
        <p>You can zip up to 100 photos at a time. For more, download in several rounds. Large zips can take a moment to start, so keep the page open and wait.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Not working?</h2>
        <p>Try again with fewer photos, check that you have storage space and a steady connection. If it still fails, contact the admin on WhatsApp.</p>
        <a href={WA_HELP_LINK} target="_blank" rel="noopener noreferrer" className="inline-block rounded bg-rast-gold px-5 py-3 font-bold text-rast-night">
          Contact admin on WhatsApp
        </a>
      </section>
    </div>
  );
}
