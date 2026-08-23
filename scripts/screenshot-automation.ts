#!/usr/bin/env npx tsx

/**
 * App Store Screenshot Automation Script
 * 
 * This script uses Puppeteer to capture screenshots for App Store submission.
 * It generates screenshots for all required device sizes and all 6 languages.
 * 
 * App Store Required Sizes:
 * - iPhone 6.7" (1290 x 2796) - iPhone 15 Pro Max
 * - iPhone 6.5" (1284 x 2778) - iPhone 15 Plus
 * - iPhone 5.5" (1242 x 2208) - iPhone 8 Plus
 * - iPad Pro 12.9" (2048 x 2732)
 * 
 * Play Store Required Sizes:
 * - Phone screenshots (min 320px, max 3840px)
 * - Tablet 7" screenshots
 * - Tablet 10" screenshots
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Device viewport configurations
const DEVICES = {
  'iphone-6.7': { width: 430, height: 932, name: 'iPhone 6.7"' },
  'iphone-6.5': { width: 428, height: 926, name: 'iPhone 6.5"' },
  'iphone-5.5': { width: 414, height: 736, name: 'iPhone 5.5"' },
  'ipad-12.9': { width: 1024, height: 1366, name: 'iPad Pro 12.9"' },
};

// Languages supported
const LANGUAGES = ['fi', 'en', 'sv', 'ar', 'ru', 'so'];

// Base URL (use environment variable or default to localhost)
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Test accounts for different roles
const TEST_ACCOUNTS = {
  superAdmin: { email: 'super@rutiini.fi', password: 'Super123!' },
  admin: { email: 'admin@testi.fi', password: 'Admin123!' },
  staff: { email: 'staff@testi.fi', password: 'Staff123!' },
  guardian: { email: 'guardian@test.fi', password: 'Guardian123!' },
};

// Screenshot scenarios
interface ScreenshotScenario {
  name: string;
  role: 'superAdmin' | 'admin' | 'staff' | 'guardian' | 'none';
  daycareCode?: string;
  path: string;
  waitFor?: string;
  actions?: (page: Page) => Promise<void>;
  description: string;
}

const SCENARIOS: ScreenshotScenario[] = [
  // Login Flow
  {
    name: '01-login-daycare-code',
    role: 'none',
    path: '/',
    description: 'Login page - Daycare code entry',
  },
  {
    name: '02-login-role-selection',
    role: 'none',
    path: '/',
    description: 'Login page - Role selection',
    actions: async (page) => {
      await page.type('[data-testid="input-daycare-code"]', 'TESTI');
      await page.click('[data-testid="button-submit-code"]');
      await page.waitForSelector('[data-testid="button-role-admin"]', { timeout: 5000 });
    },
  },
  // Admin Dashboard
  {
    name: '03-admin-dashboard',
    role: 'admin',
    daycareCode: 'testi',
    path: '/dashboard',
    waitFor: '[data-testid="text-dashboard-title"]',
    description: 'Admin dashboard with statistics',
  },
  // Children Management
  {
    name: '04-children-list',
    role: 'admin',
    daycareCode: 'testi',
    path: '/children',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Children list view',
  },
  // Daily Entries
  {
    name: '05-daily-entries',
    role: 'staff',
    daycareCode: 'testi',
    path: '/entries',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Daily entries logging',
  },
  // Trips Management
  {
    name: '06-trips',
    role: 'admin',
    daycareCode: 'testi',
    path: '/trips',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Trip management',
  },
  // Messages
  {
    name: '07-messages',
    role: 'staff',
    daycareCode: 'testi',
    path: '/messages',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Messaging system',
  },
  // Guardian Dashboard
  {
    name: '08-guardian-dashboard',
    role: 'guardian',
    daycareCode: 'testi',
    path: '/dashboard',
    waitFor: '[data-testid="text-dashboard-title"]',
    description: 'Guardian dashboard',
  },
  // Absence Reporting (Guardian)
  {
    name: '09-absence-reporting',
    role: 'guardian',
    daycareCode: 'testi',
    path: '/absences',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Absence reporting',
  },
  // Super Admin - Daycares
  {
    name: '10-superadmin-daycares',
    role: 'superAdmin',
    path: '/super-admin/daycares',
    waitFor: '[data-testid="text-page-title"]',
    description: 'Super Admin daycare management',
  },
];

async function ensureDirectoryExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper function to wait for a specified time
async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setLanguage(page: Page, language: string) {
  await page.evaluate((lang) => {
    localStorage.setItem('i18nextLng', lang);
  }, language);
  await page.reload({ waitUntil: 'networkidle2' });
}

async function login(page: Page, role: string, daycareCode?: string) {
  const account = TEST_ACCOUNTS[role as keyof typeof TEST_ACCOUNTS];
  if (!account) return;

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });

  // Wait for page to load
  await page.waitForSelector('[data-testid="input-daycare-code"]', { timeout: 10000 }).catch(() => null);

  // Check if we need to enter daycare code (non-super-admin)
  if (role !== 'superAdmin' && daycareCode) {
    const codeInput = await page.$('[data-testid="input-daycare-code"]');
    if (codeInput) {
      await page.type('[data-testid="input-daycare-code"]', daycareCode.toUpperCase());
      await page.click('[data-testid="button-submit-code"]');
      await wait(1000);
    }

    // Select role
    const roleButtonMap: Record<string, string> = {
      admin: 'button-role-admin',
      staff: 'button-role-staff',
      guardian: 'button-role-guardian',
    };
    const roleButton = roleButtonMap[role];
    if (roleButton) {
      await page.waitForSelector(`[data-testid="${roleButton}"]`, { timeout: 5000 }).catch(() => null);
      const btn = await page.$(`[data-testid="${roleButton}"]`);
      if (btn) {
        await btn.click();
        await wait(500);
      }
    }
  } else if (role === 'superAdmin') {
    // Super admin login - click super admin button if available
    const superAdminBtn = await page.$('[data-testid="button-super-admin-login"]');
    if (superAdminBtn) {
      await superAdminBtn.click();
      await wait(500);
    }
  }

  // Enter credentials
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 5000 }).catch(() => null);
  const emailInput = await page.$('[data-testid="input-email"]');
  if (emailInput) {
    await page.type('[data-testid="input-email"]', account.email);
    await page.type('[data-testid="input-password"]', account.password);
    await page.click('[data-testid="button-login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null);
  }
}

async function captureScreenshot(
  browser: Browser,
  scenario: ScreenshotScenario,
  device: keyof typeof DEVICES,
  language: string
) {
  const page = await browser.newPage();
  const viewport = DEVICES[device];
  
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 3, // High resolution for App Store
  });

  try {
    // Set language
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await setLanguage(page, language);

    // Login if needed
    if (scenario.role !== 'none') {
      await login(page, scenario.role, scenario.daycareCode);
    }

    // Navigate to the target path
    if (scenario.path !== '/') {
      await page.goto(`${BASE_URL}${scenario.path}`, { waitUntil: 'networkidle2' });
    }

    // Wait for specific element if specified
    if (scenario.waitFor) {
      await page.waitForSelector(scenario.waitFor, { timeout: 10000 }).catch(() => {
        console.log(`Warning: Could not find ${scenario.waitFor} for ${scenario.name}`);
      });
    }

    // Execute custom actions if any
    if (scenario.actions) {
      await scenario.actions(page);
    }

    // Wait a bit for animations to settle
    await wait(1000);

    // Create output directory
    const outputDir = path.join('screenshots', device, language);
    await ensureDirectoryExists(outputDir);

    // Capture screenshot
    const filename = `${scenario.name}.png`;
    const filepath = path.join(outputDir, filename);
    
    await page.screenshot({
      path: filepath,
      fullPage: false,
    });

    console.log(`✓ ${device}/${language}/${filename}`);
  } catch (error) {
    console.error(`✗ Failed: ${device}/${language}/${scenario.name}:`, error);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('=== Rutiini App Store Screenshot Automation ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Devices: ${Object.keys(DEVICES).join(', ')}`);
  console.log(`Languages: ${LANGUAGES.join(', ')}`);
  console.log(`Scenarios: ${SCENARIOS.length}\n`);

  // Create base screenshots directory
  await ensureDirectoryExists('screenshots');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    // For each device
    for (const device of Object.keys(DEVICES) as (keyof typeof DEVICES)[]) {
      console.log(`\n📱 Processing device: ${DEVICES[device].name}`);
      
      // For each language
      for (const language of LANGUAGES) {
        console.log(`  🌍 Language: ${language}`);
        
        // For each scenario
        for (const scenario of SCENARIOS) {
          await captureScreenshot(browser, scenario, device, language);
        }
      }
    }

    console.log('\n=== Screenshot capture complete! ===');
    console.log(`Screenshots saved to: ${path.resolve('screenshots')}`);
    
    // Generate summary
    const summary = {
      generatedAt: new Date().toISOString(),
      devices: Object.keys(DEVICES),
      languages: LANGUAGES,
      scenarios: SCENARIOS.map(s => ({ name: s.name, description: s.description })),
      totalScreenshots: Object.keys(DEVICES).length * LANGUAGES.length * SCENARIOS.length,
    };
    
    fs.writeFileSync('screenshots/summary.json', JSON.stringify(summary, null, 2));
    console.log('Summary saved to: screenshots/summary.json');
  } finally {
    await browser.close();
  }
}

// Run if called directly
main().catch(console.error);
