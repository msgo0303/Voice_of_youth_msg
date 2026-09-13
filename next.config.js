/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Rewrite /design to /design/index.html
      {
        source: '/design',
        destination: '/design/index.html',
      },
      {
        source: '/design/',
        destination: '/design/index.html',
      },
      // Also rewrite stitch_telegram_survey_mini_app to /design for backward compatibility
      {
        source: '/stitch_telegram_survey_mini_app',
        destination: '/design/index.html',
      },
      {
        source: '/stitch_telegram_survey_mini_app/',
        destination: '/design/index.html',
      },
      {
        source: '/stitch_telegram_survey_mini_app/:path*',
        destination: '/design/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
