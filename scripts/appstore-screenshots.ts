import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';
const SCREENSHOTS_DIR = './appstore-screenshots';

// All required iPhone sizes with exact pixel dimensions
const IPHONE_SIZES: Record<string, { width: number; height: number }> = {
  '6.9inch': { width: 440, height: 956 },   // 1320x2868 at 3x
  '6.5inch': { width: 414, height: 896 },   // 1242x2688 at 3x - DONE
  '6.3inch': { width: 430, height: 932 },   // 1290x2796 at 3x
  '6.1inch': { width: 393, height: 852 },   // 1179x2556 at 3x
  '5.5inch': { width: 414, height: 736 },   // 1242x2208 at 3x - DONE
  '4.7inch': { width: 375, height: 667 },   // 750x1334 at 2x
  '4inch': { width: 320, height: 568 },     // 640x1136 at 2x
  '3.5inch': { width: 320, height: 480 }    // 640x960 at 2x
};

// Skip sizes already done
const SKIP_SIZES = ['6.5inch', '5.5inch'];

const TEST_ACCOUNTS = {
  admin: {
    email: 'appstore-admin@rutiini.com',
    password: 'AppleReview123!',
    daycareCode: 'rutiini',
    buttonTestId: 'button-login-daycareleader'
  },
  staff: {
    email: 'appstore-staff@rutiini.com',
    password: 'AppleReview123!',
    daycareCode: 'rutiini',
    buttonTestId: 'button-login-staff'
  },
  guardian: {
    email: 'appstore-guardian@rutiini.com',
    password: 'AppleReview123!',
    daycareCode: 'rutiini',
    buttonTestId: 'button-login-guardian'
  }
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function takeSimpleScreenshot(
  url: string,
  screenshotPath: string,
  width: number,
  height: number,
  loginInfo?: { email: string; password: string; daycareCode: string; buttonTestId: string }
) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 3 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fi-FI,fi;q=0.9' });
    
    if (loginInfo) {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(1000);
      
      const daycareInput = await page.$('[data-testid="input-daycare-code"]');
      if (daycareInput) {
        await daycareInput.type(loginInfo.daycareCode);
        await delay(300);
        const continueBtn = await page.$('[data-testid="button-continue"]');
        if (continueBtn) { await continueBtn.click(); await delay(1500); }
      }
      
      const roleBtn = await page.$(`[data-testid="${loginInfo.buttonTestId}"]`);
      if (roleBtn) { await roleBtn.click(); await delay(1500); }
      
      const emailInput = await page.$('[data-testid="input-email"]');
      if (emailInput) await emailInput.type(loginInfo.email);
      
      const passwordInput = await page.$('[data-testid="input-password"]');
      if (passwordInput) await passwordInput.type(loginInfo.password);
      
      await delay(300);
      const loginBtn = await page.$('[data-testid="button-login"]');
      if (loginBtn) await loginBtn.click();
      await delay(2000);
    }
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(1500);
    
    await ensureDir(path.dirname(screenshotPath));
    await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' });
    console.log(`OK: ${screenshotPath}`);
    
  } catch (e) {
    console.log(`FAIL: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Capturing App Store screenshots...\n');
  await ensureDir(SCREENSHOTS_DIR);

  for (const [sizeName, sizeConfig] of Object.entries(IPHONE_SIZES)) {
    if (SKIP_SIZES.includes(sizeName)) {
      console.log(`Skipping ${sizeName} (already done)`);
      continue;
    }
    
    console.log(`\n=== ${sizeName} ===`);
    
    await takeSimpleScreenshot(`${BASE_URL}/`, `${SCREENSHOTS_DIR}/${sizeName}/00-login.png`, sizeConfig.width, sizeConfig.height);
    await takeSimpleScreenshot(`${BASE_URL}/dashboard`, `${SCREENSHOTS_DIR}/${sizeName}/01-admin-dashboard.png`, sizeConfig.width, sizeConfig.height, TEST_ACCOUNTS.admin);
    await takeSimpleScreenshot(`${BASE_URL}/children`, `${SCREENSHOTS_DIR}/${sizeName}/02-admin-children.png`, sizeConfig.width, sizeConfig.height, TEST_ACCOUNTS.admin);
    await takeSimpleScreenshot(`${BASE_URL}/dashboard`, `${SCREENSHOTS_DIR}/${sizeName}/03-staff-dashboard.png`, sizeConfig.width, sizeConfig.height, TEST_ACCOUNTS.staff);
    await takeSimpleScreenshot(`${BASE_URL}/dashboard`, `${SCREENSHOTS_DIR}/${sizeName}/04-guardian-dashboard.png`, sizeConfig.width, sizeConfig.height, TEST_ACCOUNTS.guardian);
    await takeSimpleScreenshot(`${BASE_URL}/meal-menu`, `${SCREENSHOTS_DIR}/${sizeName}/05-guardian-menu.png`, sizeConfig.width, sizeConfig.height, TEST_ACCOUNTS.guardian);
  }
  
  console.log('\n=== DONE ===');
  console.log(`Screenshots in: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
