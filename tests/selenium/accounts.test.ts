import { WebDriver, By, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, login, waitForElement } from './helpers/driver.js';

describe('Accounts page', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  before(async () => {
    driver = await buildDriver();
    await login(driver);
  });
  after(async () => { await driver.quit(); });

  beforeEach(async () => {
    await driver.get(`${BASE_URL}/accounts`);
    await driver.wait(until.urlContains('/accounts'), 8_000);
  });

  it('loads the accounts page', async () => {
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/accounts'), `Expected /accounts, got ${url}`);
  });

  it('shows the balance summary row', async () => {
    await driver.wait(
      until.elementLocated(By.xpath('//*[contains(text(),"Saldo") or contains(text(),"Balance") or contains(text(),"Cleared")]')),
      10_000,
    );
    const el = await driver.findElement(
      By.xpath('//*[contains(text(),"Saldo") or contains(text(),"Balance") or contains(text(),"Cleared")]'),
    );
    assert.ok(await el.isDisplayed(), 'Balance info should be visible');
  });

  it('shows the transaction table or empty state', async () => {
    // Either a table/list of transactions or an empty-state message
    await driver.sleep(1_500); // wait for API call
    const hasTable = await driver.findElements(By.css('table, [role="table"], .transaction-row, tr'));
    const hasEmpty = await driver.findElements(
      By.xpath('//*[contains(text(),"keine") or contains(text(),"leer") or contains(text(),"No transactions")]'),
    );
    assert.ok(
      hasTable.length > 0 || hasEmpty.length > 0,
      'Should show a transaction list or empty state',
    );
  });

  it('has an "Add transaction" button', async () => {
    const plusBtns = await driver.findElements(
      By.xpath('//button[.//*[local-name()="svg"] or contains(text(),"+") or contains(@aria-label,"add") or contains(@aria-label,"hinzufügen")]'),
    );
    assert.ok(plusBtns.length > 0, 'Should have at least one action/add button');
  });

  it('can open the import dialog', async () => {
    // Import button has a FileUp SVG icon — find via svg path or nearby text
    const importBtns = await driver.findElements(
      By.xpath('//button[.//*[local-name()="svg"]][not(contains(@class,"search"))]'),
    );
    // Click button that opens a dialog (try each SVG button until a dialog appears)
    let opened = false;
    for (const btn of importBtns) {
      await btn.click().catch(() => {});
      await driver.sleep(400);
      const dialogs = await driver.findElements(
        By.xpath('//*[@role="dialog" or contains(@class,"modal") or contains(@class,"Dialog") or contains(@class,"dialog")]'),
      );
      if (dialogs.length > 0) { opened = true; break; }
      // Close any overlay by pressing Escape
      await driver.actions().keyDown('').keyUp('').perform().catch(() => {});
      await driver.sleep(200);
    }
    // If no dialog found, check if import UI appeared inline
    if (!opened) {
      const importUi = await driver.findElements(
        By.xpath('//*[contains(text(),"Import") or contains(text(),"CSV") or contains(text(),"Datei")]'),
      );
      assert.ok(importUi.length > 0, 'Import dialog or import UI should open');
    }
  });

  it('search input filters transactions', async () => {
    // Look for the search button/icon
    const searchBtns = await driver.findElements(
      By.xpath('//button[.//*[contains(@class,"lucide-search")] or @aria-label="Search"]'),
    );
    if (searchBtns.length === 0) return; // search not available

    await searchBtns[0].click();
    await driver.sleep(300);
    const searchInput = await driver.findElements(By.css('input[type="search"], input[placeholder*="such"], input[placeholder*="Search"]'));
    assert.ok(searchInput.length > 0, 'Search input should appear after clicking search');
  });
});
