import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tramites/form-contracts'],
  webpack(config) {
    // `@tramites/form-contracts` es NodeNext: sus imports relativos usan
    // sufijo `.js` apuntando a archivos `.ts` (lo exige el resolver de Node
    // en ESM). Webpack no sabe mapear eso solo, así que sin este alias
    // cualquier import que traiga un *valor* (no un type) del barril raíz
    // del paquete falla con "Module not found" — los imports de solo tipo
    // no lo sufren porque se borran antes de llegar a webpack.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
