/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['archiver'],
  // Ask Chromium browsers (Android) to send the device model on later requests
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Accept-CH', value: 'Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;
