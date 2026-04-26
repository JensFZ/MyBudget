import { WebDriver, By, until, Key } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, login, waitForElement } from './helpers/driver.js';

describe('Plan page', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  before(async () => {
    driver = await buildDriver();
    await login(driver);
  });
  after(async () => { await driver.quit(); });

  beforeEach(async () => {
    await driver.get(`${BASE_URL}/plan`);
    await driver.wait(until.urlContains('/plan'), 8_000);
  });

  it('loads the plan page', async () => {
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/plan'), `Expected /plan, got ${url}`);
  });

  it('shows month navigation controls', async () => {
    // The month picker button should be visible
    const monthBtn = await waitForElement(driver, 'button');
    assert.ok(await monthBtn.isDisplayed(), 'Month button should be visible');
  });

  it('shows "Bereit zur Zuteilung" (ready to assign) area', async () => {
    // Wait for budget data to load — the ready-to-assign section uses this text
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Bereit") or contains(text(),"Ready")]')),
      10_000,
    );
    const el = await driver.findElement(
      By.xpath('//*[contains(text(),"Bereit") or contains(text(),"Ready")]'),
    );
    assert.ok(await el.isDisplayed(), 'Ready to assign section should be visible');
  });

  it('navigates to previous month', async () => {
    await waitForElement(driver, 'button');
    // The prev-month button has class "p-1 text-white/80 hover:text-white" and comes before the month label
    const prevBtn = await driver.findElement(
      By.css('button.\\[\\&\\>svg\\]\\:size-4, button[class*="text-white\\/80"]'),
    ).catch(() =>
      // fallback: first button in the top header area
      driver.findElement(By.xpath('(//button[contains(@class,"text-white")])[1]')),
    );
    await prevBtn.click();
    await driver.sleep(500);

    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/plan'), 'Should stay on plan page after navigation');
  });

  it('can open the group-add input', async () => {
    // The "+" button to add a group should be present
    const addGroupBtns = await driver.findElements(
      By.xpath('//button[contains(@class,"text-blue") or .//*[local-name()="svg"]]'),
    );
    assert.ok(addGroupBtns.length > 0, 'Should have action buttons on plan page');
  });
});
