const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const qaDir = 'c:/Users/wang/esponal/qa-artifacts/nav-001';
  if (!fs.existsSync(qaDir)) {
    fs.mkdirSync(qaDir, { recursive: true });
  }

  const routes = [
    { name: 'home', path: '/' },
    { name: 'phonics', path: '/phonics' },
    { name: 'grammar', path: '/grammar' }
  ];

  const viewports = [
    { name: 'mobile', width: 375, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 }
  ];

  // Helper to change theme via button or localStorage
  const setDarkTheme = async (page) => {
    await page.evaluate(() => {
      localStorage.setItem('color-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
  };

  const setLightTheme = async (page) => {
    await page.evaluate(() => {
      localStorage.setItem('color-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
  };

  for (const route of routes) {
    console.log(`Processing route: ${route.path}`);
    for (const vp of viewports) {
      console.log(`- Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });
      const page = await context.newPage();
      
      // 1. Light Mode
      await page.goto(`http://localhost:3000${route.path}`);
      await page.waitForTimeout(1000); // wait for load
      await setLightTheme(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(qaDir, `${route.name}-${vp.name}-light.png`) });

      // 2. Dark Mode
      await setDarkTheme(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(qaDir, `${route.name}-${vp.name}-dark.png`) });

      // 3. Mobile Specific Interactions
      if (vp.name === 'mobile') {
        // Toggle mobile nav drawer (light mode)
        await setLightTheme(page);
        const burgerBtn = page.getByRole('button', { name: '打开导航菜单' });
        if (await burgerBtn.isVisible()) {
          console.log(`  - Opening mobile drawer (light)`);
          await burgerBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(qaDir, `${route.name}-mobile-drawer-light.png`) });

          // Test dark mode drawer
          console.log(`  - Emulating dark mode drawer`);
          await setDarkTheme(page);
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(qaDir, `${route.name}-mobile-drawer-dark.png`) });
          
          // Click close menu
          const closeBtn = page.getByRole('button', { name: '关闭菜单' });
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }

        // Toggle mobile search overlay
        await setLightTheme(page);
        const searchBtn = page.getByRole('button', { name: '搜索' });
        if (await searchBtn.isVisible()) {
          console.log(`  - Opening mobile search overlay (light)`);
          await searchBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(qaDir, `${route.name}-mobile-search-light.png`) });

          // Test dark mode search overlay
          console.log(`  - Emulating dark mode search overlay`);
          await setDarkTheme(page);
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(qaDir, `${route.name}-mobile-search-dark.png`) });

          // Close search overlay
          const cancelBtn = page.getByRole('button', { name: '取消' });
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('Screenshots taken successfully.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
