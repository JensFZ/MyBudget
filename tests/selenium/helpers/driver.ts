import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
export const TEST_EMAIL = process.env.TEST_EMAIL ?? 'test@example.com';
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'password';

export async function buildDriver(headless = true): Promise<WebDriver> {
  const options = new chrome.Options();
  if (headless) {
    options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage');
  }
  options.addArguments('--window-size=1280,800');

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
}

export async function login(driver: WebDriver): Promise<void> {
  await driver.get(`${BASE_URL}/login`);
  await driver.wait(until.elementLocated(By.css('input[type="email"]')), 10_000);
  await driver.findElement(By.css('input[type="email"]')).sendKeys(TEST_EMAIL);
  await driver.findElement(By.css('input[type="password"]')).sendKeys(TEST_PASSWORD);
  await driver.findElement(By.css('button[type="submit"]')).click();
  await driver.wait(until.urlContains('/plan'), 10_000);
}

export async function waitForElement(driver: WebDriver, selector: string, timeout = 10_000): Promise<WebElement> {
  return driver.wait(until.elementLocated(By.css(selector)), timeout);
}

export async function waitForText(driver: WebDriver, selector: string, text: string, timeout = 10_000): Promise<void> {
  const el = await waitForElement(driver, selector, timeout);
  await driver.wait(until.elementTextContains(el, text), timeout);
}
