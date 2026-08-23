import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "attached_assets", "real_screenshots");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface ScreenshotConfig {
  name: string;
  width: number;
  height: number;
  prefix: string;
}

const SIZES: ScreenshotConfig[] = [
  { name: "phone", width: 375, height: 667, prefix: "phone" },
  { name: "tablet", width: 768, height: 1024, prefix: "tablet" },
  { name: "chromebook", width: 1920, height: 1080, prefix: "chromebook" },
];

const APP_URL = "http://localhost:5000";

async function takeScreenshot(
  page: Page,
  filename: string
): Promise<void> {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: false,
  });
  console.log(`✓ Screenshot saved: ${filename}`);
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreenshots(): Promise<void> {
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    for (const size of SIZES) {
      console.log(`\n📱 Capturing ${size.name} screenshots...`);

      const page = await browser.newPage();
      await page.setViewport({ width: size.width, height: size.height });

      // Navigate to app
      await page.goto(APP_URL, { waitUntil: "networkidle2", timeout: 10000 });
      await delay(2000);

      // Screenshot 1: Login screen (daycare code entry)
      await takeScreenshot(
        page,
        `${size.prefix}_01_login_daycare_code.png`
      );

      // Try to click on the daycare code input and enter test code
      try {
        await page.waitForSelector('input[placeholder*="koodilla"]', {
          timeout: 5000,
        });
        await page.type('input[placeholder*="koodilla"]', "demo123", {
          delay: 100,
        });
        await delay(500);
        await takeScreenshot(page, `${size.prefix}_02_login_code_entered.png`);

        // Click continue button
        const buttons = await page.$$eval("button", (btns) =>
          btns
            .filter((btn) =>
              btn.textContent?.toLowerCase().includes("jatka")
            )
            .slice(0, 1)
        );

        if (buttons.length > 0) {
          await page.click("button");
          await delay(1500);
        }
      } catch (e) {
        console.log("Note: Could not interact with login form");
      }

      // Screenshot 2: Role selection screen
      try {
        await page.waitForSelector("button", { timeout: 5000 });
        await takeScreenshot(page, `${size.prefix}_03_role_selection.png`);
      } catch (e) {
        console.log("Note: Role selection not found");
      }

      // Screenshot 3: Email/Password login
      try {
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
        await page.type('input[type="email"]', "staff@demo.com", {
          delay: 50,
        });
        await page.type('input[type="password"]', "password123", {
          delay: 50,
        });
        await delay(500);
        await takeScreenshot(page, `${size.prefix}_04_login_credentials.png`);

        // Click login button
        const loginBtn = await page.$('button');
        if (loginBtn) {
          await loginBtn.click();
          await delay(3000);
        }
      } catch (e) {
        console.log("Note: Could not complete login form");
      }

      // Screenshot 4: Dashboard
      try {
        await page.waitForSelector("main", { timeout: 5000 });
        await delay(1000);
        await takeScreenshot(page, `${size.prefix}_05_dashboard.png`);
      } catch (e) {
        console.log("Note: Dashboard not visible");
      }

      // Screenshot 5: Try to navigate to messaging
      try {
        const links = await page.$$("a, button");
        for (const link of links) {
          const text = await page.evaluate((el) => el.textContent, link);
          if (text?.toLowerCase().includes("viesti")) {
            await link.click();
            await delay(2000);
            await takeScreenshot(page, `${size.prefix}_06_messaging.png`);
            break;
          }
        }
      } catch (e) {
        console.log("Note: Could not navigate to messaging");
      }

      // Screenshot 6: Try to navigate to children/entries
      try {
        await page.goto(`${APP_URL}`, { waitUntil: "networkidle2" });
        await delay(1500);
        await takeScreenshot(page, `${size.prefix}_07_children_view.png`);
      } catch (e) {
        console.log("Note: Could not navigate to children view");
      }

      // Screenshot 7: Notifications
      try {
        const notificationBtn = await page.$('button[aria-label*="ilmoitus"]');
        if (notificationBtn) {
          await notificationBtn.click();
          await delay(1000);
          await takeScreenshot(
            page,
            `${size.prefix}_08_notifications.png`
          );
        }
      } catch (e) {
        console.log("Note: Could not access notifications");
      }

      await page.close();
    }

    console.log("\n✅ Screenshot capture complete!");
    console.log(`📁 Screenshots saved to: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error("❌ Error capturing screenshots:", error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the capture
captureScreenshots().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
