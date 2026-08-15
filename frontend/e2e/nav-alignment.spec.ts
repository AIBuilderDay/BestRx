import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('bea@hospice-a.example');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/catalog');
}

type HeadingBox = { x: number; y: number };

async function pageHeadingBox(page: Page, name: string): Promise<HeadingBox> {
  const heading = page.getByRole('heading', { level: 1, name });
  await expect(heading).toBeVisible();
  return heading.evaluate((element) => {
    const { x, y } = element.getBoundingClientRect();
    return { x, y };
  });
}

function expectAligned(a: HeadingBox, b: HeadingBox, tolerance = 2) {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(tolerance);
}

test('catalog, orders, and patients page titles align when switching tabs', async ({ page }) => {
  await signIn(page);

  const catalog = await pageHeadingBox(page, 'Equipment');

  await page.getByRole('link', { name: 'Orders' }).click();
  await expect(page).toHaveURL('/orders');
  const orders = await pageHeadingBox(page, 'Orders');

  await page.getByRole('link', { name: 'Patients' }).click();
  await expect(page).toHaveURL('/patients');
  const patients = await pageHeadingBox(page, 'Patients');

  expectAligned(catalog, orders);
  expectAligned(orders, patients);
});

test('patients nav label is capitalized', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Patients' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Patients' })).toBeVisible();
});
