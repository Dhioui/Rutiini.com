import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "attached_assets", "real_screenshots");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  prefix: string;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: "phone", width: 375, height: 667, prefix: "phone" },
  { name: "tablet", width: 768, height: 1024, prefix: "tablet" },
  { name: "chromebook", width: 1920, height: 1080, prefix: "chromebook" },
];

const APP_URL = "http://localhost:5000";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshots(): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n📱 Capturing ${viewport.name} screenshots...`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: "fi-FI",
      });

      const page = await context.newPage();

      try {
        // Screenshot 1: Login screen - initial load
        console.log(`  1. Loading login screen...`);
        await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
        await delay(1500);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${viewport.prefix}_01_login_daycare_code.png`),
          fullPage: false,
        });
        console.log(`  ✓ Screenshot 1: Login (daycare code)`);

        // Screenshot 2: Role selection (if available)
        try {
          await page.waitForSelector("button", { timeout: 3000 });
          await delay(500);
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `${viewport.prefix}_02_role_selection.png`),
            fullPage: false,
          });
          console.log(`  ✓ Screenshot 2: Role selection`);
        } catch (e) {
          console.log(`  - Role selection not found, skipping`);
        }

        // Screenshot 3: Login form
        try {
          const emailInput = await page.$('input[type="email"]');
          if (emailInput) {
            await delay(300);
            await page.screenshot({
              path: path.join(OUTPUT_DIR, `${viewport.prefix}_03_login_credentials.png`),
              fullPage: false,
            });
            console.log(`  ✓ Screenshot 3: Login credentials form`);
          }
        } catch (e) {
          console.log(`  - Login form not found, skipping`);
        }

        // Screenshot 4: Dashboard
        try {
          await page.waitForSelector("main", { timeout: 3000 });
          await delay(800);
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `${viewport.prefix}_04_dashboard.png`),
            fullPage: false,
          });
          console.log(`  ✓ Screenshot 4: Dashboard`);
        } catch (e) {
          console.log(`  - Dashboard not found, skipping`);
        }

        // Screenshot 5: Notifications area
        try {
          const notificationArea = await page.$('[data-testid*="notification"]');
          if (notificationArea) {
            await delay(300);
            await page.screenshot({
              path: path.join(OUTPUT_DIR, `${viewport.prefix}_05_notifications.png`),
              fullPage: false,
            });
            console.log(`  ✓ Screenshot 5: Notifications`);
          }
        } catch (e) {
          console.log(`  - Notifications area not found, skipping`);
        }

      } catch (error) {
        console.error(`  ❌ Error capturing screenshots for ${viewport.name}:`, error);
      } finally {
        await context.close();
      }
    }

    console.log(`\n✅ Screenshot capture complete!`);
    console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);

    // List all captured screenshots
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
    console.log(`\n📸 Captured files (${files.length} total):`);
    files.forEach(f => console.log(`   - ${f}`));

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
