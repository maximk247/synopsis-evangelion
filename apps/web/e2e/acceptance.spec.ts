import { expect, test } from '@playwright/test';

test('pericope 12 renders a single Luke column', async ({ page }) => {
  await page.goto('/p/12');
  await expect(page.getByText('Перикопа 12')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Лука', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toHaveCount(0);
});

test('pericope 21 shows Matthew and the John fragment', async ({ page }) => {
  await page.goto('/p/21');
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Иоанн', exact: true })).toBeVisible();
});

test('pericope 51.1 shows numbered Beatitudes in Mt and Lk columns', async ({ page }) => {
  await page.goto('/p/51.1');
  await expect(page.getByRole('heading', { name: 'Матфей', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Лука', exact: true })).toBeVisible();
  await expect(page.getByText('Блаженны').first()).toBeVisible();
  expect(await page.locator('.vnum').count()).toBeGreaterThan(0);
});

test('contents filter: reference "Мф 5:3" offers a jump link to pericope 51.1', async ({
  page
}) => {
  await page.goto('/');
  await page.getByLabel('Фильтр перикоп').fill('Мф 5:3');
  const link = page.getByRole('link', { name: /Перейти к Мф/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/p\/51\.1/);
});

test('contents filter: full-text "Агнец Божий" finds John 1:29', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Фильтр перикоп').fill('Агнец Божий');
  await expect(page.getByText('Ин 1:29')).toBeVisible();
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

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('settings menu: clicking the panel keeps it open, outside click closes it', async ({
  page
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 10, y: 10 } });
  await expect(dialog).toBeVisible();
  await page.locator('.scrim').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
});
