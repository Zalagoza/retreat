import { DEVELOPER_URL } from '@/lib/config';

export const metadata = { title: 'About Us' };

export default function About() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-4">
      <h1 className="text-2xl font-bold text-rast-gold">About Us</h1>
      <p className="leading-relaxed">
        This is Mungiki Chanel.{' '}
        <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer" className="text-rast-gold underline">
          Roots of Wathu Digital Creations
        </a>
      </p>
    </div>
  );
}
