import { WebDriver, By, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, login } from './helpers/driver.js';

describe('Account detail page', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  before(async () => {
    driver = await buildDriver();
    await login(driver);
  });
  after(async () => { await driver.quit(); });

  async function navigateToFirstAccount(): Promise<void> {
    await driver.get(`${BASE_URL}/accounts`);
    await driver.wait(until.urlContains('/accounts'), 8_000);
    // Find the first link that leads to an individual account (e.g. /accounts/123)
    await driver.wait(
      until.elementLocated(By.xpath('//a[contains(@href,"/accounts/") and not(contains(@href,"/accounts/#"))]')),
      10_000,
    );
    const accountLink = await driver.findElement(
      By.xpath('//a[contains(@href,"/accounts/") and not(contains(@href,"/accounts/#"))]'),
    );
    await accountLink.click();
    await driver.wait(
      until.urlMatches(/\/accounts\/[^/]+$/),
      8_000,
    );
  }

  it('navigates to an account detail page', async () => {
    await navigateToFirstAccount();
    const url = await driver.getCurrentUrl();
    assert.ok(/\/accounts\/[^/]+$/.test(url), `Expected /accounts/<id>, got ${url}`);
  });

  it('shows account name and balance breakdown', async () => {
    await navigateToFirstAccount();
    // Account name is text-xl font-bold
    await driver.wait(until.elementLocated(By.css('.text-xl.font-bold')), 10_000);
    const name = await driver.findElement(By.css('.text-xl.font-bold'));
    assert.ok((await name.getText()).length > 0, 'Account name should not be empty');

    // Balance row shows "Cleared" / "Uncleared" / "Working" labels
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Cleared") or contains(text(),"Uncleared") or contains(text(),"cleared") or contains(text(),"Kontostand")]')),
      8_000,
    );
  });

  it('shows the transaction table with column headers', async () => {
    await navigateToFirstAccount();
    // Wait for table — either a real <table> or the sticky header row
    await driver.wait(
      until.elementLocated(By.css('table thead, [role="table"] [role="columnheader"], th')),
      10_000,
    );
    const headers = await driver.findElements(By.css('table thead th, th'));
    assert.ok(headers.length > 0, 'Transaction table should have column headers');
  });

  it('has an "Add transaction" button', async () => {
    await navigateToFirstAccount();
    await driver.wait(until.elementLocated(By.css('.bg-blue-600')), 8_000);
    const addBtn = await driver.findElement(By.css('.bg-blue-600'));
    assert.ok(await addBtn.isDisplayed(), '"Add transaction" button (blue) should be visible');
  });

  it('has filter pills (all / uncleared / needs category)', async () => {
    await navigateToFirstAccount();
    // Filter pills are small rounded buttons with border
    await driver.wait(
      until.elementLocated(By.css('.rounded-full.border')),
      8_000,
    );
    const pills = await driver.findElements(By.css('.rounded-full.border'));
    assert.ok(pills.length >= 2, 'Should have at least two filter pills');
  });

  it('can open the edit account modal', async () => {
    await navigateToFirstAccount();
    // Edit button (pencil icon) sits next to the account name
    await driver.wait(until.elementLocated(By.css('.text-xl.font-bold')), 10_000);
    const editBtns = await driver.findElements(
      By.xpath('//button[.//*[contains(@class,"lucide-edit") or contains(@class,"lucide-pencil") or contains(@class,"lucide-edit-2")]]'),
    );
    assert.ok(editBtns.length > 0, 'Edit button should be present');
    await editBtns[0].click();

    // Modal should appear
    await driver.wait(
      until.elementLocated(By.css('[role="dialog"], .rounded-2xl.shadow-2xl')),
      8_000,
    );
    const modal = await driver.findElement(By.css('[role="dialog"], .rounded-2xl.shadow-2xl'));
    assert.ok(await modal.isDisplayed(), 'Edit account modal should be visible');

    // Close modal via Cancel button
    const cancelBtns = await driver.findElements(
      By.xpath('//button[contains(text(),"Cancel") or contains(text(),"Abbrechen")]'),
    );
    if (cancelBtns.length > 0) await cancelBtns[0].click();
  });
});
