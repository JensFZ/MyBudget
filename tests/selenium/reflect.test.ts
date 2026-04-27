import { WebDriver, By, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, login } from './helpers/driver.js';

describe('Reflect page', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  before(async () => {
    driver = await buildDriver();
    await login(driver);
  });
  after(async () => { await driver.quit(); });

  beforeEach(async () => {
    await driver.get(`${BASE_URL}/reflect`);
    await driver.wait(until.urlContains('/reflect'), 8_000);
  });

  it('loads the reflect page', async () => {
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/reflect'), `Expected /reflect, got ${url}`);
  });

  it('shows the net worth card with a value', async () => {
    // Wait until loading state is gone and a numeric value appears
    await driver.wait(
      until.elementLocated(By.css('.text-4xl')),
      12_000,
    );
    const netWorthEl = await driver.findElement(By.css('.text-4xl'));
    const text = await netWorthEl.getText();
    assert.ok(text.length > 0, 'Net worth value should not be empty');
  });

  it('shows assets and debts sections', async () => {
    await driver.wait(
      until.elementLocated(By.css('.text-green-600')),
      12_000,
    );
    const assetsEl = await driver.findElement(By.css('.text-green-600'));
    assert.ok(await assetsEl.isDisplayed(), 'Assets value (green) should be visible');

    const debtsEl = await driver.findElement(By.css('.text-red-500'));
    assert.ok(await debtsEl.isDisplayed(), 'Debts value (red) should be visible');
  });

  it('shows at least one chart', async () => {
    // Recharts renders SVG elements
    await driver.wait(
      until.elementLocated(By.css('svg')),
      12_000,
    );
    const charts = await driver.findElements(By.css('svg'));
    assert.ok(charts.length > 0, 'At least one chart (SVG) should be rendered');
  });
});
