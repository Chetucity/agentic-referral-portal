/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },

  webpack: (config, { isServer }) => {
    /**
     * pdf.js ships a Node rendering path that optionally requires `canvas`,
     * a native module. The resume builder only ever parses PDFs in the
     * browser, where that path is dead code — but webpack still tries to
     * resolve the import and fails the build. Marking it false resolves it to
     * an empty module instead.
     */
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    /**
     * The same library reaches for Node built-ins that do not exist in the
     * browser bundle.
     */
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    return config;
  },
};

export default nextConfig;
