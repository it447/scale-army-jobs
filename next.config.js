/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Tell webpack to ignore playwright completely — it's optional
      config.externals = [...(config.externals || []), 'playwright'];
    }
    return config;
  },
};
