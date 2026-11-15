import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 960, height: 640 }, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI },
});
