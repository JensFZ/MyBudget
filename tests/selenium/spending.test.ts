import { WebDriver, By, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, login } from './helpers/driver.js';

describe('Spending page', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  before(async () => {
    driver = await buildDriver();
    await login(driver);
  });
  after(async () => { await driver.quit(); });

  beforeEach(async () => {
    await driver.get(`${BASE_URL}/spending`);
    await driver.wait(until.urlContains('/spending'), 8_000);
  });

  it('loads the spending page', async () => {
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/spending'), `Expected /spending, got ${url}`);
  });

  it('shows the "Ausgaben" heading', async () => {
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Ausgaben")]')),
      10_000,
    );
    const heading = await driver.findElement(By.xpath('//*[contains(text(),"Ausgaben")]'));
    assert.ok(await heading.isDisplayed(), '"Ausgaben" heading should be visible');
  });

  it('shows transaction rows or an empty state', async () => {
    await driver.sleep(1_500); // wait for API response
    const rows = await driver.findElements(By.css('.px-4.py-3.border-b, [class*="border-b"][class*="py-3"]'));
    const empty = await driver.findElements(
      By.xpath('//*[contains(text(),"Keine Transaktionen") or contains(text(),"No transactions")]'),
    );
    assert.ok(rows.length > 0 || empty.length > 0, 'Should show transaction rows or empty-state message');
  });

  it('has a floating action button to add a transaction', async () => {
    const fab = await driver.wait(
      until.elementLocated(By.css('.rounded-full.bg-blue-600, button.rounded-full')),
      8_000,
    );
    assert.ok(await fab.isDisplayed(), 'FAB button should be visible');
  });

  it('shows search input after clicking search button', async () => {
    const searchBtns = await driver.findElements(
      By.xpath('//button[.//*[contains(@class,"lucide-search")] or @aria-label="Search"]'),
    );
    assert.ok(searchBtns.length > 0, 'Search button should be present on spending page');

    await searchBtns[0].click();
    await driver.wait(
      until.elementLocated(By.css('input[placeholder*="such"], input[placeholder*="Suche"], input[type="search"]')),
      5_000,
    );
    const searchInput = await driver.findElement(
      By.css('input[placeholder*="such"], input[placeholder*="Suche"], input[type="search"]'),
    );
    assert.ok(await searchInput.isDisplayed(), 'Search input should appear after clicking search button');
  });
});
