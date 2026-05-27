import { chromium } from "playwright";
import fs from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3010/";
const outDir = "qa-artifacts/codex2-ui-optimization-qa";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const pageErrors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });

const initial = await page.evaluate(() => {
  const html = document.documentElement;
  const main = document.querySelector("main");
  const header = document.querySelector("header");
  const themeButtons = [...document.querySelectorAll("button")].filter((button) =>
    /切换到|主题|theme/i.test(button.getAttribute("aria-label") || button.textContent || "")
  );
  const cards = [...document.querySelectorAll('[data-testid="learning-step-card"]')];
  const ctas = cards.map((card) => card.querySelector("a"));
  const canvas = document.querySelector("canvas");
  return {
    htmlDark: html.classList.contains("dark"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    mainBg: main ? getComputedStyle(main).backgroundColor : null,
    headerBg: header ? getComputedStyle(header).backgroundColor : null,
    themeButtonCount: themeButtons.length,
    themeButtonLabels: themeButtons.map((button) => button.getAttribute("aria-label") || button.textContent?.trim()),
    cardCount: cards.length,
    cardHeights: cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    ctaTops: ctas.map((cta) => Math.round(cta?.getBoundingClientRect().top ?? 0)),
    ctaBottoms: ctas.map((cta) => Math.round(cta?.getBoundingClientRect().bottom ?? 0)),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    canvas: canvas ? {
      width: Math.round(canvas.getBoundingClientRect().width),
      height: Math.round(canvas.getBoundingClientRect().height),
      x: Math.round(canvas.getBoundingClientRect().x),
      y: Math.round(canvas.getBoundingClientRect().y),
    } : null,
  };
});

await page.screenshot({ path: `${outDir}/home-light-1600.png`, fullPage: true });

const beforeSample = await page.locator("canvas").evaluate((canvas) => {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let alphaPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) alphaPixels += 1;
  }
  return { width: canvas.width, height: canvas.height, alphaPixels };
});

await page.mouse.move(800, 300);
await page.waitForTimeout(450);
await page.mouse.move(250, 650);
await page.waitForTimeout(450);

const afterSample = await page.locator("canvas").evaluate((canvas) => {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let alphaPixels = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) alphaPixels += 1;
  }
  const rect = canvas.getBoundingClientRect();
  return { width: canvas.width, height: canvas.height, alphaPixels, rect: {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    x: Math.round(rect.x),
    y: Math.round(rect.y),
  } };
});

await page.screenshot({ path: `${outDir}/home-particles-after-mouse-1600.png`, fullPage: true });

const themeButton = page.locator('button[aria-label*="切换到"], button[aria-label*="theme" i]').first();
await themeButton.click();
await page.waitForTimeout(250);
const afterFirstToggle = await page.evaluate(() => ({
  htmlDark: document.documentElement.classList.contains("dark"),
  storedTheme: localStorage.getItem("color-theme"),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  mainBg: getComputedStyle(document.querySelector("main")).backgroundColor,
  headerBg: getComputedStyle(document.querySelector("header")).backgroundColor,
}));
await page.screenshot({ path: `${outDir}/home-after-first-toggle-1600.png`, fullPage: true });

await themeButton.click();
await page.waitForTimeout(250);
const afterSecondToggle = await page.evaluate(() => ({
  htmlDark: document.documentElement.classList.contains("dark"),
  storedTheme: localStorage.getItem("color-theme"),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  mainBg: getComputedStyle(document.querySelector("main")).backgroundColor,
  headerBg: getComputedStyle(document.querySelector("header")).backgroundColor,
}));
await page.screenshot({ path: `${outDir}/home-after-second-toggle-1600.png`, fullPage: true });

const mobilePage = await browser.newPage({ viewport: { width: 375, height: 900 }, deviceScaleFactor: 1 });
const mobileErrors = [];
mobilePage.on("console", (msg) => { if (msg.type() === "error") mobileErrors.push(msg.text()); });
await mobilePage.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
const mobile = await mobilePage.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  themeButtonCount: [...document.querySelectorAll("button")].filter((button) =>
    /切换到|主题|theme/i.test(button.getAttribute("aria-label") || button.textContent || "")
  ).length,
  bodyBg: getComputedStyle(document.body).backgroundColor,
}));
await mobilePage.screenshot({ path: `${outDir}/home-mobile-375.png`, fullPage: true });
await mobilePage.close();

await browser.close();

const result = {
  baseUrl,
  initial,
  particleCanvas: { beforeSample, afterSample },
  afterFirstToggle,
  afterSecondToggle,
  mobile,
  consoleErrors,
  pageErrors,
  mobileErrors,
  screenshots: [
    `${outDir}/home-light-1600.png`,
    `${outDir}/home-particles-after-mouse-1600.png`,
    `${outDir}/home-after-first-toggle-1600.png`,
    `${outDir}/home-after-second-toggle-1600.png`,
    `${outDir}/home-mobile-375.png`,
  ],
};

await fs.writeFile(`${outDir}/result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
