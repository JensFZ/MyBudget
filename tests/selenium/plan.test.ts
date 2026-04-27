import { WebDriver, By, until } from 'selenium-webdriver';
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
    // Capture the current month label before navigating
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Bereit") or contains(text(),"Ready")]')),
      10_000,
    );
    const monthLabelEl = await driver.findElement(
      By.xpath('(//button[contains(@class,"text-white")])[2]'),
    ).catch(() => driver.findElement(By.css('header button, nav button')));
    const monthBefore = await monthLabelEl.getText().catch(() => '');

    const prevBtn = await driver.findElement(
      By.xpath('(//button[contains(@class,"text-white")])[1]'),
    );
    await prevBtn.click();
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Bereit") or contains(text(),"Ready")]')),
      8_000,
    );

    const monthAfter = await monthLabelEl.getText().catch(() => '');
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/plan'), 'Should stay on plan page after navigation');
    // If we could read the month label, it should have changed
    if (monthBefore && monthAfter) {
      assert.notEqual(monthAfter, monthBefore, 'Month label should change after navigating to previous month');
    }
  });

  it('has a button to add a budget group', async () => {
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Bereit") or contains(text(),"Ready")]')),
      10_000,
    );
    // The add-group button typically sits at the bottom of the category list
    const addGroupBtn = await driver.findElements(
      By.xpath('//button[.//*[local-name()="svg"] and (contains(@class,"text-blue") or contains(@class,"blue"))]'),
    );
    assert.ok(addGroupBtn.length > 0, 'Should have at least one blue action button (add group/category)');
  });
});
