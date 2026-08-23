import puppeteer from 'puppeteer';
import { storage } from './storage';
import type { InsertMealMenu } from '@shared/schema';

interface ParsedMenuItem {
  mealType: 'breakfast' | 'lunch' | 'vegetarian_lunch' | 'snack';
  foodName: string;
  foodDescription?: string;
  dietInfo?: string;
}

interface FoodItem {
  name: string;
  dietCodes: string[];
}

function parseFoodLine(line: string): FoodItem[] {
  const items: FoodItem[] = [];
  
  const cleanLine = line.trim();
  
  const foodPattern = /([A-ZÄÖÅa-zäöå][a-zäöåA-ZÄÖÅ\-\s]+?)(?:\s+([LMGNSK,\s♥]+(?:Veg)?[,\s♥]*))\s*(?:,|$)/g;
  
  let match;
  while ((match = foodPattern.exec(cleanLine)) !== null) {
    const foodName = match[1].trim();
    const dietString = match[2] || '';
    
    const dietCodes: string[] = [];
    const dietPattern = /\b([LMGNSK]|Veg|VL|VEG)\b/g;
    let dietMatch;
    while ((dietMatch = dietPattern.exec(dietString)) !== null) {
      dietCodes.push(dietMatch[1]);
    }
    if (dietString.includes('♥')) {
      dietCodes.push('♥');
    }
    
    if (foodName.length >= 3 && 
        !foodName.match(/^[\s]+$/) &&
        !foodName.match(/^[LMGNSK,\s]+$/) &&
        foodName !== 'TAI') {
      items.push({
        name: foodName,
        dietCodes: Array.from(new Set(dietCodes))
      });
    }
  }
  
  if (items.length === 0) {
    const simpleParts = cleanLine.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    for (const part of simpleParts) {
      const dietPattern = /\b([LMGNSK]|Veg|VL|VEG)\b/g;
      const dietCodes: string[] = [];
      let dietMatch;
      while ((dietMatch = dietPattern.exec(part)) !== null) {
        dietCodes.push(dietMatch[1]);
      }
      if (part.includes('♥')) {
        dietCodes.push('♥');
      }
      
      let foodName = part
        .replace(/\b([LMGNSK]|Veg|VL|VEG)\b/g, '')
        .replace(/♥/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (foodName.length >= 3 && 
          !foodName.match(/^[\s]+$/) &&
          foodName !== 'TAI') {
        items.push({
          name: foodName,
          dietCodes: Array.from(new Set(dietCodes))
        });
      }
    }
  }
  
  return items;
}

function formatFoodWithDiet(items: FoodItem[]): string {
  return items
    .filter(item => {
      const lower = item.name.toLowerCase();
      return !lower.includes('löydät') && 
             !lower.includes('täällä') && 
             !lower.includes('sisältää') &&
             !lower.includes('portaat') &&
             !lower.includes('oiva') &&
             !lower.includes('anna meille') &&
             !lower.includes('parasta') &&
             !lower.includes('sosiaalisen') &&
             !lower.includes('cgi') &&
             !lower.includes('saavutettavuus') &&
             item.name !== 'TAI' &&
             item.name !== 'tai' &&
             !item.name.startsWith('-');
    })
    .map(item => {
      if (item.dietCodes.length > 0) {
        return `${item.name} ${item.dietCodes.join(', ')}`;
      }
      return item.name;
    })
    .join(' | ');
}

async function parseAromiWithPuppeteer(sourceUrl: string): Promise<ParsedMenuItem[]> {
  const items: ParsedMenuItem[] = [];
  let browser = null;
  
  try {
    console.log('[MenuScraper] Launching Puppeteer browser...');
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('[MenuScraper] Navigating to Aromi page:', sourceUrl);
    await page.goto(sourceUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    console.log('[MenuScraper] Waiting for content to load...');
    await page.waitForSelector('body', { timeout: 10000 });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const pageContent = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('[MenuScraper] Page content length:', pageContent.length);
    
    const lines = pageContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let currentMealType: 'breakfast' | 'lunch' | 'vegetarian_lunch' | 'snack' | null = null;
    let currentMealIndex = -1;
    let currentFoods: FoodItem[] = [];
    
    const stopPatterns = [
      'Ajankohtaista', 'Lisätiedot', 'Ruokalistan', 'Allergeeni',
      'PALKE', 'Restaurant', 'Ruokalajin nimen', 'Tuote- ja soveltuvuus',
      'Aterioilla on lisäksi', 'Päiväkodit ovat', 'Oiva-hymymme',
      'Anna meille palautetta', 'Parasta yhdessä', 'Oletko huomannut',
      'sosiaalisen median', '-Parempi valinta', '-Laktoositon',
      '-Maidoton', '-Gluteeniton', '-Naudanlihaton', '-Sianlihaton',
      '-Kananmunaton', '-Vegaaninen', 'CGI', 'Saavutettavuus',
      'infopainikkeesta', 'raaka-aineet', 'ravintosisällön',
      'löydät täältä', '-Sisältää', 'satokauden', 
      'Portaat luomuun', 'erityisruokavaliot', 'keittiöhenkilökunnan',
      'tuoreita kasviksia', 'ruokajuomaa', 'näkkileipää', 'margariinia',
      'Etusivulle', 'TÄNÄÄN', 'TÄMÄ VIIKKO', 'SEURAAVA VIIKKO', 'Kolmas viikko',
      'Tulosta', 'FI', 'SV', 'EN'
    ];
    
    const saveMeal = () => {
      if (currentMealType && currentFoods.length > 0) {
        const formatted = formatFoodWithDiet(currentFoods);
        if (formatted.length > 0) {
          items.push({
            mealType: currentMealType,
            foodName: formatted,
          });
        }
        currentFoods = [];
      }
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (stopPatterns.some(p => line.includes(p))) {
        continue;
      }
      
      const lowerLine = line.toLowerCase();
      
      if (lowerLine === 'aamupala' || line === 'Aamupala') {
        saveMeal();
        currentMealType = 'breakfast';
        currentMealIndex = 0;
        continue;
      }
      
      if (lowerLine === 'lounas' || line === 'Lounas' || line === 'Lounas.') {
        if (currentMealIndex < 1) {
          saveMeal();
          currentMealType = 'lunch';
          currentMealIndex = 1;
        }
        continue;
      }
      
      if (lowerLine === 'kasvislounas' || line === 'Kasvislounas' || lowerLine.includes('kasvislounas')) {
        if (currentMealIndex < 2) {
          saveMeal();
          currentMealType = 'vegetarian_lunch';
          currentMealIndex = 2;
        }
        continue;
      }
      
      if (lowerLine === 'välipala' || line === 'Välipala') {
        if (currentMealIndex < 3) {
          saveMeal();
          currentMealType = 'snack';
          currentMealIndex = 3;
        }
        continue;
      }
      
      if (line.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/) ||
          line.match(/^(ma|ti|ke|to|pe|la|su)$/i) ||
          line.length < 3) {
        continue;
      }
      
      if (currentMealType && line.length >= 3) {
        const foodItems = parseFoodLine(line);
        currentFoods.push(...foodItems);
      }
    }
    
    saveMeal();
    
    await browser.close();
    console.log('[MenuScraper] Parsed', items.length, 'menu items');
    items.forEach(item => {
      console.log(`[MenuScraper] ${item.mealType}: ${item.foodName}`);
    });
    
    return items;
    
  } catch (error: any) {
    console.error('[MenuScraper] Puppeteer error:', error.message);
    if (browser) {
      await browser.close();
    }
    return [];
  }
}

export async function scrapeMenuFromSource(sourceUrl?: string): Promise<{ success: boolean; items: ParsedMenuItem[]; error?: string }> {
  const url = sourceUrl || 'https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/PKeMenu/Page/Restaurant';
  try {
    console.log('[MenuScraper] Starting menu scrape with Puppeteer from:', url);
    const items = await parseAromiWithPuppeteer(url);
    
    if (items.length > 0) {
      return { success: true, items };
    } else {
      return { success: false, items: [], error: 'No menu items found' };
    }
  } catch (error: any) {
    console.error('[MenuScraper] Error:', error.message);
    return { success: false, items: [], error: error.message };
  }
}

export async function saveMenuToDatabase(items: ParsedMenuItem[], date: string, sourceUrl: string): Promise<void> {
  await storage.deleteMealMenuByDate(date);
  
  for (const item of items) {
    const menuData: InsertMealMenu = {
      date,
      mealType: item.mealType,
      foodName: item.foodName,
      foodDescription: item.foodDescription,
      dietInfo: item.dietInfo,
      sourceUrl,
    };
    
    await storage.createMealMenu(menuData);
  }
  
  console.log(`[MenuScraper] Saved ${items.length} menu items for ${date}`);
}

export async function fetchAndSaveMenu(): Promise<{ success: boolean; message: string }> {
  const today = new Date().toISOString().split('T')[0];
  const sourceUrl = 'https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/PKeMenu/Page/Restaurant';
  
  const result = await scrapeMenuFromSource();
  
  if (result.success && result.items.length > 0) {
    await saveMenuToDatabase(result.items, today, sourceUrl);
    return { success: true, message: `Saved ${result.items.length} menu items for ${today}` };
  } else if (result.success && result.items.length === 0) {
    return { success: false, message: 'No menu items found on the source page' };
  } else {
    return { success: false, message: result.error || 'Failed to fetch menu' };
  }
}

export async function fetchAndSaveMenuForDaycare(daycareId: number, sourceUrl?: string): Promise<{ success: boolean; message: string }> {
  const today = new Date().toISOString().split('T')[0];
  const url = sourceUrl || 'https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/PKeMenu/Page/Restaurant';
  
  const result = await scrapeMenuFromSource(url);
  
  if (result.success && result.items.length > 0) {
    await storage.deleteMealMenuByDate(today, daycareId);
    
    for (const item of result.items) {
      const menuData: InsertMealMenu = {
        daycareId,
        date: today,
        mealType: item.mealType,
        foodName: item.foodName,
        foodDescription: item.foodDescription,
        dietInfo: item.dietInfo,
        sourceUrl: url,
      };
      
      await storage.createMealMenu(menuData);
    }
    
    console.log(`[MenuScraper] Saved ${result.items.length} menu items for daycare ${daycareId} on ${today}`);
    return { success: true, message: `Saved ${result.items.length} menu items for ${today}` };
  } else if (result.success && result.items.length === 0) {
    return { success: false, message: 'No menu items found on the source page' };
  } else {
    return { success: false, message: result.error || 'Failed to fetch menu' };
  }
}

export async function getTodaysMenu(): Promise<{ date: string; items: any[] }> {
  const today = new Date().toISOString().split('T')[0];
  
  let items = await storage.getMealMenuByDate(today);
  let date = today;
  
  if (items.length === 0) {
    console.log('[MenuScraper] No menu for today, attempting to fetch...');
    const result = await fetchAndSaveMenu();
    if (result.success) {
      items = await storage.getMealMenuByDate(today);
    }
  }
  
  if (items.length === 0) {
    console.log('[MenuScraper] Falling back to latest available menu');
    items = await storage.getLatestMealMenu();
    if (items.length > 0) {
      date = items[0].date;
    }
  }
  
  return { date, items };
}

export async function fetchAndSaveMenuForAllDaycares(): Promise<{ success: number; failed: number; results: Array<{ daycareId: number; daycareName: string; success: boolean; message: string }> }> {
  console.log('[MenuScraper] Starting daily menu fetch for all daycares...');
  
  const daycares = await storage.getAllDaycares();
  const municipalities = await storage.getAllMunicipalities();
  
  // Build municipality map for quick lookup
  const municipalityMap = new Map(municipalities.map(m => [m.id, m]));
  
  // Determine effective menu source for each daycare
  interface DaycareMenuConfig {
    daycareId: number;
    daycareName: string;
    sourceUrl: string;
  }
  
  const daycareConfigs: DaycareMenuConfig[] = [];
  
  for (const daycare of daycares) {
    let effectiveSourceType = daycare.menuSourceType;
    let effectiveSourceUrl = daycare.menuSourceUrl;
    
    // If daycare has no menu source set (or 'none'), check municipality default
    if ((!effectiveSourceType || effectiveSourceType === 'none') && daycare.municipalityId) {
      const municipality = municipalityMap.get(daycare.municipalityId);
      if (municipality && municipality.defaultMenuSourceType === 'aromi' && municipality.defaultMenuSourceUrl) {
        effectiveSourceType = municipality.defaultMenuSourceType;
        effectiveSourceUrl = municipality.defaultMenuSourceUrl;
        console.log(`[MenuScraper] ${daycare.name}: Using municipality ${municipality.name} default menu source`);
      }
    }
    
    // Add to configs if effective source is aromi with valid URL
    if (effectiveSourceType === 'aromi' && effectiveSourceUrl) {
      daycareConfigs.push({
        daycareId: daycare.id,
        daycareName: daycare.name,
        sourceUrl: effectiveSourceUrl,
      });
    }
  }
  
  console.log(`[MenuScraper] Found ${daycareConfigs.length} daycares with Aromi source (including municipality defaults)`);
  
  // Group daycares by source URL to avoid redundant scrapes
  const urlToDaycares = new Map<string, DaycareMenuConfig[]>();
  for (const config of daycareConfigs) {
    const existing = urlToDaycares.get(config.sourceUrl) || [];
    existing.push(config);
    urlToDaycares.set(config.sourceUrl, existing);
  }
  
  console.log(`[MenuScraper] Grouped into ${urlToDaycares.size} unique menu source URLs`);
  
  let successCount = 0;
  let failedCount = 0;
  const results: Array<{ daycareId: number; daycareName: string; success: boolean; message: string }> = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch once per unique URL and save to all daycares using that URL
  for (const [sourceUrl, configs] of Array.from(urlToDaycares.entries())) {
    try {
      console.log(`[MenuScraper] Fetching menu from: ${sourceUrl} (for ${configs.length} daycares)`);
      const scrapeResult = await scrapeMenuFromSource(sourceUrl);
      
      if (scrapeResult.success && scrapeResult.items.length > 0) {
        // Save to all daycares using this source
        for (const config of configs) {
          try {
            await storage.deleteMealMenuByDate(today, config.daycareId);
            
            for (const item of scrapeResult.items) {
              const menuData: InsertMealMenu = {
                daycareId: config.daycareId,
                date: today,
                mealType: item.mealType,
                foodName: item.foodName,
                foodDescription: item.foodDescription,
                dietInfo: item.dietInfo,
                sourceUrl,
              };
              await storage.createMealMenu(menuData);
            }
            
            successCount++;
            results.push({
              daycareId: config.daycareId,
              daycareName: config.daycareName,
              success: true,
              message: `Saved ${scrapeResult.items.length} menu items`,
            });
            console.log(`[MenuScraper] Successfully saved menu for ${config.daycareName}`);
          } catch (saveError: any) {
            failedCount++;
            results.push({
              daycareId: config.daycareId,
              daycareName: config.daycareName,
              success: false,
              message: saveError.message,
            });
            console.error(`[MenuScraper] Failed to save menu for ${config.daycareName}: ${saveError.message}`);
          }
        }
      } else {
        // Mark all daycares using this URL as failed
        for (const config of configs) {
          failedCount++;
          results.push({
            daycareId: config.daycareId,
            daycareName: config.daycareName,
            success: false,
            message: scrapeResult.error || 'No menu items found',
          });
        }
        console.log(`[MenuScraper] Failed to fetch menu from ${sourceUrl}: ${scrapeResult.error || 'No items'}`);
      }
      
      // Rate limiting between URL scrapes
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      for (const config of configs) {
        failedCount++;
        results.push({
          daycareId: config.daycareId,
          daycareName: config.daycareName,
          success: false,
          message: error.message,
        });
      }
      console.error(`[MenuScraper] Error fetching menu from ${sourceUrl}:`, error.message);
    }
  }
  
  console.log(`[MenuScraper] Daily menu fetch complete. Success: ${successCount}, Failed: ${failedCount}`);
  return { success: successCount, failed: failedCount, results };
}

export const dietInfoLegend: Record<string, { fi: string; en: string }> = {
  'L': { fi: 'Laktoositon', en: 'Lactose-free' },
  'M': { fi: 'Maidoton', en: 'Dairy-free' },
  'G': { fi: 'Gluteeniton', en: 'Gluten-free' },
  'N': { fi: 'Naudanlihaton', en: 'No beef' },
  'S': { fi: 'Sianlihaton', en: 'No pork' },
  'K': { fi: 'Kananmunaton', en: 'Egg-free' },
  'Veg': { fi: 'Vegaaninen', en: 'Vegan' },
  'VL': { fi: 'Vähälaktoosinen', en: 'Low lactose' },
  '♥': { fi: 'Parempi valinta', en: 'Better choice' },
};
