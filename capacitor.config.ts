import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mealcritic.app",
  appName: "급식평론가",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_yami",
      iconColor: "#0ea5e9",
    },
  },
};

export default config;
