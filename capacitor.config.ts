import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orderfast.app',
  appName: 'Orderfast',
  webDir: 'www',
  server: {
    url: 'https://orderfast.vercel.app',
  },
};

export default config;
