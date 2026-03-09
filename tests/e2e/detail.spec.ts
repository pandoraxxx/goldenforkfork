import { expect, test } from '@playwright/test';

test.describe('Stock detail page', () => {
  test('renders chart, indicators and fundamentals tabs', async ({ page }) => {
    await page.goto('/stock/00700');

    await expect(page.getByTestId('stock-detail-page')).toBeVisible();
    await expect(page.getByTestId('stock-summary-card')).toBeVisible();

    await page.getByTestId('detail-tab-chart').click();
    await expect(page.getByTestId('chart-card')).toBeVisible();

    await page.getByTestId('detail-tab-indicators').click();
    await expect(page.getByTestId('indicators-card')).toBeVisible();
    await expect(page.getByTestId('moving-average-card')).toBeVisible();
    await expect(page.getByTestId('golden-cross-card')).toBeVisible();

    await page.getByTestId('detail-tab-fundamentals').click();
    await expect(page.getByText('估值指标')).toBeVisible();
    await expect(page.getByText('市场数据')).toBeVisible();
  });

  test('regression: 02977 opens detail instead of not-found', async ({ page }) => {
    await page.goto('/stock/02977');

    await expect(page.getByTestId('stock-not-found')).toHaveCount(0);
    await expect(page.getByTestId('stock-detail-page')).toBeVisible();
    await expect(page.getByTestId('stock-price')).toContainText('HK$');
  });
});
