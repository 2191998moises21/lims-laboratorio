import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Habilitar verificación de tipos en build
  typescript: {
    // En desarrollo podemos ignorar, en producción debe fallar
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },

  // React Strict Mode para detectar bugs
  reactStrictMode: true,

  // Optimizaciones de imagen
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
