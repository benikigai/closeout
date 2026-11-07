import type { NextConfig } from 'next';
const config: NextConfig = {
  outputFileTracingIncludes: { '/api/demo': ['./demo-bin/**', './demo-source/heldout.json'] },
};
export default config;
