import { expect, test } from '@playwright/test';

test('pericope 12 renders a single Luke column', async ({ page }) => {
  await page.goto('/p/12');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('12.');
  await expect(page.getByRole('heading', { name: 'Лука', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toHaveCount(0);
});

test('pericope 21 shows Mt + John fragment with prev and next links', async ({ page }) => {
  await page.goto('/p/21');
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Иоанн', exact: true })).toBeVisible();
  await expect(page.getByText('ранее:').first()).toBeVisible();
  await expect(page.getByText('далее:').first()).toBeVisible();
});

test('pericope 51.1 shows numbered Beatitudes in Mt and Lk columns', async ({ page }) => {
  await page.goto('/p/51.1');
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Лука', exact: true })).toBeVisible();
  await expect(page.getByText('Блаженны').first()).toBeVisible();
  expect(await page.locator('.vnum').count()).toBeGreaterThan(0);
});

test('reference search "Мф 3:13" jumps to pericope 21', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Мф 3:13'));
  await expect(page).toHaveURL(/\/p\/21/);
});

test('reference search "Мф 5:3" jumps to pericope 51.1', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Мф 5:3'));
  await expect(page).toHaveURL(/\/p\/51\.1/);
});

test('full-text "Агнец Божий" finds John 1:29 and 1:36', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Агнец Божий'));
  await expect(page.getByText('Ин 1:29')).toBeVisible();
  await expect(page.getByText('Ин 1:36')).toBeVisible();
});

test('at 390px columns become tabs and the page does not overflow horizontally', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/p/21');
  await expect(page.getByRole('tab', { name: 'Матфей' })).toBeVisible();
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(noOverflow).toBe(true);
});

test('chronology table scrolls without breaking the page width at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/appendix');
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(noOverflow).toBe(true);
});

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('settings drawer: clicking the panel keeps it open, scrim closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 10, y: 10 } });
  await expect(dialog).toBeVisible();
  await page.locator('.scrim').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
});
