import { WebDriver, By, until } from 'selenium-webdriver';
import assert from 'node:assert/strict';
import { buildDriver, BASE_URL, TEST_EMAIL, TEST_PASSWORD, login } from './helpers/driver.js';

describe('Authentication', function () {
  this.timeout(30_000);
  let driver: WebDriver;

  beforeEach(async () => { driver = await buildDriver(); });
  afterEach(async () => { await driver.quit(); });

  it('redirects to /login when not authenticated', async () => {
    await driver.get(`${BASE_URL}/plan`);
    await driver.wait(until.urlContains('/login'), 8_000);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/login'), `Expected /login, got ${url}`);
  });

  it('shows login form with email and password fields', async () => {
    await driver.get(`${BASE_URL}/login`);
    await driver.wait(until.elementLocated(By.css('input[type="email"]')), 8_000);
    const emailInput = await driver.findElement(By.css('input[type="email"]'));
    const passwordInput = await driver.findElement(By.css('input[type="password"]'));
    assert.ok(await emailInput.isDisplayed(), 'Email input should be visible');
    assert.ok(await passwordInput.isDisplayed(), 'Password input should be visible');
  });

  it('shows error on wrong credentials', async () => {
    await driver.get(`${BASE_URL}/login`);
    await driver.wait(until.elementLocated(By.css('input[type="email"]')), 8_000);
    await driver.findElement(By.css('input[type="email"]')).sendKeys('wrong@example.com');
    await driver.findElement(By.css('input[type="password"]')).sendKeys('wrongpassword');
    await driver.findElement(By.css('button[type="submit"]')).click();
    // Error message should appear (red text)
    await driver.wait(until.elementLocated(By.css('.text-red-500')), 8_000);
    const errorEl = await driver.findElement(By.css('.text-red-500'));
    assert.ok(await errorEl.isDisplayed(), 'Error message should be visible');
  });

  it('logs in successfully and redirects to /plan', async () => {
    await login(driver);
    const url = await driver.getCurrentUrl();
    assert.ok(url.includes('/plan'), `Expected /plan after login, got ${url}`);
  });

  it('can toggle password visibility', async () => {
    await driver.get(`${BASE_URL}/login`);
    await driver.wait(until.elementLocated(By.css('input[type="password"]')), 8_000);
    const pwInput = await driver.findElement(By.css('input[type="password"]'));
    assert.equal(await pwInput.getAttribute('type'), 'password', 'Should start as password type');

    // Click the eye icon button
    const toggleBtn = await driver.findElement(By.css('button[type="button"]'));
    await toggleBtn.click();
    const typeAfter = await pwInput.getAttribute('type');
    assert.equal(typeAfter, 'text', 'Should switch to text type after toggle');
  });
});
