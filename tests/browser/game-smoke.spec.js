import { expect, test } from '@playwright/test';

async function startBattle(page, mode) {
  if (mode) await page.locator(`[data-mode="${mode}"]`).click();
  await page.getByRole('button', { name: 'Start battle' }).click();
  await expect(page.locator('#more')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.choice').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('difficulty selection produces four, four, and six answers', async ({ page }) => {
  for (const [mode, count] of [['genus', 4], ['species', 4], ['both', 6]]) {
    const radio = page.locator(`[data-mode="${mode}"]`);
    await radio.click();
    await expect(radio).toHaveAttribute('aria-checked', 'true');
    await startBattle(page);
    await expect(page.locator('.choice:visible')).toHaveCount(count);
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('#screen-title')).toBeVisible();
  }
});

test('keyboard answer works and battle advances to the next encounter', async ({ page }) => {
  const easy = page.locator('[data-mode="genus"]');
  await easy.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-mode="species"]')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-mode="both"]')).toHaveAttribute('aria-checked', 'true');
  await startBattle(page);
  const firstPhoto = await page.locator('#foe-img').getAttribute('src');
  await page.keyboard.press('6');
  await expect(page.locator('.choice[data-i="5"].is-correct, .choice[data-i="5"].is-wrong')).toHaveCount(1);

  for (let attempt = 0; attempt < 20; attempt++) {
    if (await page.locator('.choice:visible:not(:disabled)').count() === 6) break;
    await page.locator('#scene').click();
    await page.waitForTimeout(80);
  }
  await expect(page.locator('.choice:visible:not(:disabled)')).toHaveCount(6);
  await expect(page.locator('#foe-img')).not.toHaveAttribute('src', firstPhoto);
});

test('Field guide shows names and preserves card details, search, and role filters', async ({ page }) => {
  const deck = await page.evaluate(async () => (await (await fetch('data/deck.json')).json()).species);
  await page.getByRole('button', { name: 'Field guide' }).click();

  const cards = page.locator('.card-tile');
  await expect(cards).toHaveCount(143);
  const cardNames = await page.locator('.card-tile__name').allTextContents();
  expect(cardNames).toHaveLength(143);
  expect(cardNames.every((name) => name.trim() && name !== '???')).toBe(true);
  const first = cards.first();
  await first.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#card-body')).toContainText('Not discovered yet.');
  await page.getByRole('button', { name: 'Close' }).click();

  const entry = deck[0];
  await page.locator('#guide-filter').selectOption(entry.role);
  await page.locator('#guide-search').fill(entry.scientific);
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator('.card-tile__name')).toContainText(entry.common || entry.scientific);
  await expect(page.locator('#guide-count')).toHaveText('Identified 0 of 1');
  const commonEntry = deck.find((candidate) => candidate.common);
  if (commonEntry) {
    await page.locator('#guide-filter').selectOption(commonEntry.role);
    await page.locator('#guide-search').fill(commonEntry.common);
    await expect(cards.filter({ hasText: commonEntry.common })).toHaveCount(1);
  }
  await page.locator('#guide-search').fill('no-organism-matches-this');
  await expect(page.locator('#guide-count')).toHaveText('Identified 0 of 0');
  await expect(page.locator('.guide__empty')).toHaveText('No organisms match this search.');
});

test('Credits displays the app version', async ({ page }) => {
  await page.getByRole('button', { name: 'Credits' }).click();
  await expect(page.locator('#app-version')).toHaveText('v0.1.0');
});

test('identified Field guide cards retain their photo and organism details', async ({ page }) => {
  const entry = await page.evaluate(async () => {
    const deck = (await (await fetch('data/deck.json')).json()).species;
    const identified = deck.find((candidate) => candidate.common);
    localStorage.setItem('ecotoxid.v1', JSON.stringify({
      discovered: { [identified.id]: { seen: 1, correct: 1 } },
    }));
    return identified;
  });
  await page.reload();
  await page.getByRole('button', { name: 'Field guide' }).click();
  await page.locator('#guide-filter').selectOption(entry.role);
  await page.locator('#guide-search').fill(entry.common);
  await page.locator('.card-tile').click();
  await expect(page.locator('#card-body img')).toHaveAttribute('src', `data/photos/${entry.photo.file}`);
  await expect(page.locator('#card-body')).toContainText(entry.scientific);
  await expect(page.locator('#card-body .card__notes li').first()).not.toBeEmpty();
});

test('Hard answers fit phone portrait, desktop, and short landscape layouts', async ({ page }) => {
  await startBattle(page, 'both');
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const choices = page.locator('.choice:visible');
    await expect(choices).toHaveCount(6);
    const visibleWithinViewport = await choices.evaluateAll((buttons) =>
      buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight &&
          rect.left >= 0 && rect.right <= innerWidth;
      }));
    const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(visibleWithinViewport, `${viewport.width}x${viewport.height}: answer visibility`).toBe(true);
    expect(noHorizontalOverflow, `${viewport.width}x${viewport.height}: horizontal overflow`).toBe(true);
  }

  await page.getByRole('button', { name: 'Run' }).click();
  await page.getByRole('button', { name: 'Field guide' }).click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.card-tile')).toHaveCount(143);
    const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(noHorizontalOverflow, `Field guide ${viewport.width}x${viewport.height}: horizontal overflow`).toBe(true);
  }
});
