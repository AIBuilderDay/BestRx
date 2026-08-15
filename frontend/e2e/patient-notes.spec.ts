import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('bea@hospice-a.example');
  await page.getByLabel('Password').fill('demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/catalog');
}

test('add note opens the sticky-note editor overlay', async ({ page }) => {
  await signIn(page);
  await page.goto('/patients/PT-88611');

  await page.getByTestId('add-patient-note').click();

  const overlay = page.getByTestId('patient-note-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByLabel('Note title')).toBeVisible();
  await expect(overlay.getByLabel('Note body')).toBeVisible();
  await expect(overlay.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(overlay.getByRole('button', { name: 'Edit' })).toHaveCount(0);

  await overlay.getByLabel('Note title').fill('Weekend coverage');
  await overlay.getByLabel('Note body').fill('Confirm Saturday pickup with family before discharge.');
  await overlay.getByRole('button', { name: 'Save' }).click();

  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Weekend coverage' })).toBeVisible();
});

test('clicking a note opens the expanded editor', async ({ page }) => {
  await signIn(page);
  await page.goto('/patients/PT-88611');

  await page.getByRole('button', { name: 'Discharge pickup' }).click();

  const overlay = page.getByTestId('patient-note-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(overlay.getByRole('button', { name: 'Trash' })).toBeVisible();
});
