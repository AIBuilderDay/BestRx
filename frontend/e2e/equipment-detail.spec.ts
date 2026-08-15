import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('bea@hospice-a.example');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/catalog');
}

test('equipment detail summary shows title, then rating and price on one row', async ({ page }) => {
  await signIn(page);
  await page.goto('/catalog/OFR-003');

  const summary = page.getByTestId('equipment-detail-summary');
  await expect(summary.getByRole('heading', { level: 1, name: 'Standard Wheelchair' })).toBeVisible();
  await expect(summary.getByText('Alpine Home Medical', { exact: true })).toHaveCount(0);

  const ratingPrice = page.getByTestId('equipment-detail-rating-price');
  await expect(ratingPrice).toContainText('4.5');
  await expect(ratingPrice.getByTestId('equipment-detail-price')).toContainText('$70');

  const titleBox = await summary.getByRole('heading', { level: 1 }).boundingBox();
  const ratingPriceBox = await ratingPrice.boundingBox();
  expect(titleBox).not.toBeNull();
  expect(ratingPriceBox).not.toBeNull();
  if (!titleBox || !ratingPriceBox) return;

  expect(ratingPriceBox.y).toBeGreaterThan(titleBox.y + titleBox.height - 2);
  expect(ratingPriceBox.x).toBeLessThanOrEqual(titleBox.x + 4);

  await expect(page.getByRole('heading', { level: 2, name: 'Listing details' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'Alpine Home Medical' })).toBeVisible();
});
