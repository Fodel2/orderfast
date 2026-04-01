import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orderfast.app',
  appName: 'Orderfast1',
  webDir: 'www',
  server: {
    url: 'https://orderfast.vercel.app/dashboard/launcher',
  },
};

export default config;
