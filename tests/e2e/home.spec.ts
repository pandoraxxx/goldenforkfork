import { expect, test, type Page } from '@playwright/test';

async function openSelectAndChoose(page: Page, triggerTestId: string, itemText: string) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole('option', { name: itemText }).click();
}

test.describe('Home page', () => {
  test('loads market cards, list, tabs, sort and pair controls', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('stat-rising')).toContainText('上涨');
    await expect(page.getByTestId('stat-falling')).toContainText('下跌');
    await expect(page.getByTestId('stat-unchanged')).toContainText('平盘');

    await expect(page.getByTestId('stock-table')).toBeVisible();
    await expect(page.getByTestId('total-count')).toContainText('共找到');

    await page.getByTestId('tab-popular').click();
    await expect(page.getByTestId('tab-label')).toContainText('热门股票');
    await expect(page.getByTestId('stock-table')).toBeVisible();

    await page.getByTestId('tab-gainers').click();
    await expect(page.getByTestId('tab-label')).toContainText('涨幅榜');

    await page.getByTestId('tab-losers').click();
    await expect(page.getByTestId('tab-label')).toContainText('跌幅榜');

    await page.getByTestId('tab-all').click();
    await openSelectAndChoose(page, 'sort-select-trigger', '按代码');
    await openSelectAndChoose(page, 'sort-select-trigger', '按成交量');
    await openSelectAndChoose(page, 'pair-select-trigger', 'MA20/50');

    await page.getByTestId('search-input').fill('00700');
    await expect(page.getByTestId('total-count')).toContainText('共找到');
  });

  test('pagination and table/detail navigation work', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('stock-table')).toBeVisible();

    const firstCode = (await page.locator('tbody tr td a').first().innerText()).trim();
    expect(firstCode).toMatch(/^\d{5}$/);

    const nextBtn = page.getByTestId('pagination-next');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page.getByTestId('pagination-prev')).toBeEnabled();
    }

    await page.locator('tbody tr td a').first().click();
    await expect(page.getByTestId('stock-detail-page')).toBeVisible();
    await expect(page.getByTestId('stock-price')).toContainText('HK$');

    await page.getByTestId('back-to-home').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('home-page')).toBeVisible();
  });
});
