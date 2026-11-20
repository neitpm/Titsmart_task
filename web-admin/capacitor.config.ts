import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.workcore.companyapp',
  appName: 'WORKCORE Company App',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
    cleartext: true
  }
};

export default config;
