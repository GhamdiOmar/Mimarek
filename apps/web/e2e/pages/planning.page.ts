import { type Page, expect } from '@playwright/test';

/** Page object for /dashboard/planning and /dashboard/planning/[id] */
export class PlanningPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ─── Planning Workspaces List ──────────────────────────────────────────

  async goto() {
    await this.page.goto('/dashboard/planning');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageHeading() {
    const main = this.page.locator('main');
    await expect(main.getByText(/التخطيط|Planning OS/i).first()).toBeVisible();
  }

  async expectSearchInput() {
    await expect(
      this.page.locator('input[placeholder*="بحث في مساحات"], input[placeholder*="Search workspaces"]').first()
    ).toBeVisible();
  }

  async expectNewWorkspaceButton() {
    await expect(
      this.page.getByRole('button', { name: /مساحة عمل جديدة|New Workspace/i })
    ).toBeVisible();
  }

  async expectStatusFilterTabs() {
    // All tab should always be visible
    await expect(this.page.getByRole('button', { name: /الكل|All/i }).first()).toBeVisible();
  }

  async expectEmptyState() {
    await expect(
      this.page.getByText(/لا توجد مساحات عمل|No workspaces found/i)
    ).toBeVisible();
  }

  async clickNewWorkspace() {
    await this.page.getByRole('button', { name: /مساحة عمل جديدة|New Workspace/i }).click();
    await this.page.waitForTimeout(300);
  }

  async expectCreateWorkspaceModal() {
    await expect(
      this.page.getByRole('heading', { name: /إنشاء مساحة عمل تخطيطية|Create Planning Workspace/i })
    ).toBeVisible();
  }

  async fillWorkspaceName(name: string) {
    // Find the first input inside the create-workspace modal and fill it.
    const inputs = this.page.locator('.fixed.inset-0 input');
    await inputs.first().fill(name);
  }

  async closeModalByCancel() {
    await this.page.getByRole('button', { name: /إلغاء|Cancel/i }).click();
    await this.page.waitForTimeout(300);
  }

  async expectModalClosed() {
    await expect(this.page.locator('.fixed.inset-0')).not.toBeVisible();
  }

  async searchWorkspaces(text: string) {
    await this.page
      .locator('input[placeholder*="بحث في مساحات"], input[placeholder*="Search workspaces"]')
      .first()
      .fill(text);
  }

  async clickStatusFilter(status: string) {
    // Status labels: All/الكل, Draft/مسودة, Active/نشط, etc.
    await this.page.getByRole('button', { name: new RegExp(status, 'i') }).first().click();
    await this.page.waitForTimeout(300);
  }

  async getWorkspaceCardCount() {
    return this.page.locator('main a[href*="/dashboard/planning/"]').count();
  }

  async clickFirstWorkspace() {
    await this.page.locator('main a[href*="/dashboard/planning/"]').first().click();
    await this.page.waitForLoadState('networkidle');
  }

  // ─── Workspace Detail Page ─────────────────────────────────────────────

  async gotoWorkspace(workspaceId: string) {
    await this.page.goto(`/dashboard/planning/${workspaceId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectWorkspaceDetailLoaded() {
    // Back arrow link should be visible
    await expect(
      this.page.locator('a[href="/dashboard/planning"]').first()
    ).toBeVisible();
  }

  async expectImportButton() {
    await expect(
      this.page.getByRole('button', { name: /استيراد|Import/i })
    ).toBeVisible();
  }

  async expectNewScenarioButton() {
    await expect(
      this.page.getByRole('button', { name: /سيناريو جديد|New Scenario/i })
    ).toBeVisible();
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────

  private tabLabels: Record<string, RegExp> = {
    map: /الخريطة|Map/i,
    scenarios: /السيناريوهات|Scenarios/i,
    compliance: /الامتثال|Compliance/i,
    feasibility: /الجدوى|Feasibility/i,
    comparison: /المقارنة|Compare/i,
    comments: /التعليقات|Comments/i,
  };

  async expectTabVisible(tabKey: string) {
    const label = this.tabLabels[tabKey];
    if (!label) throw new Error(`Unknown tab: ${tabKey}`);
    await expect(this.page.getByRole('button', { name: label }).first()).toBeVisible();
  }

  async clickTab(tabKey: string) {
    const label = this.tabLabels[tabKey];
    if (!label) throw new Error(`Unknown tab: ${tabKey}`);
    await this.page.getByRole('button', { name: label }).first().click();
    await this.page.waitForTimeout(500);
  }

  // ─── Map Tab (Spatial Data) ────────────────────────────────────────────

  async expectMapContainer() {
    // The map container has a fixed 500px height
    const mapContainer = this.page.locator('[style*="height: 500px"], [style*="height:500px"]');
    await expect(mapContainer.first()).toBeVisible();
  }

  async expectLayerManager() {
    await expect(
      this.page.getByText(/الطبقات|Stack/i).first()
    ).toBeVisible();
  }

  async expectNoLayersMessage() {
    await expect(
      this.page.getByText(/لا توجد طبقات|No layers/i)
    ).toBeVisible();
  }

  async getLayerCount() {
    return this.page.locator('[class*="flex items-center justify-between py-1"]').count();
  }

  // ─── Scenarios Tab ─────────────────────────────────────────────────────

  async expectNoScenariosMessage() {
    await expect(
      this.page.getByText(/لا توجد سيناريوهات|No scenarios yet/i)
    ).toBeVisible();
  }

  async clickCreateScenarioFromEmpty() {
    await this.page.getByRole('button', { name: /إنشاء سيناريو|Create Scenario/i }).click();
    await this.page.waitForTimeout(300);
  }

  async expectNewScenarioModal() {
    await expect(
      this.page.getByText(/سيناريو جديد|New Scenario/i).first()
    ).toBeVisible();
  }

  // ─── Compliance Tab ────────────────────────────────────────────────────

  async expectComplianceHeading() {
    await expect(
      this.page.getByText(/فحص الامتثال|Compliance Check/i)
    ).toBeVisible();
  }

  async expectRunCheckButton() {
    await expect(
      this.page.getByRole('button', { name: /تشغيل الفحص|Run Check/i })
    ).toBeVisible();
  }

  // ─── Feasibility Tab ──────────────────────────────────────────────────

  async expectFeasibilityContent() {
    await expect(
      this.page.getByText(/الجدوى|Feasibility/i).first()
    ).toBeVisible();
  }

  // ─── Comments Tab ─────────────────────────────────────────────────────

  async expectCommentInput() {
    await expect(
      this.page.locator('textarea, input[placeholder*="تعليق"], input[placeholder*="comment"]').first()
    ).toBeVisible();
  }

  // ─── Import Modal ─────────────────────────────────────────────────────

  async clickImport() {
    await this.page.getByRole('button', { name: /استيراد|Import/i }).click();
    await this.page.waitForTimeout(300);
  }

  async expectImportModal() {
    await expect(this.page.locator('.fixed.inset-0')).toBeVisible();
    await expect(
      this.page.getByText(/GeoJSON|KML|CSV/i).first()
    ).toBeVisible();
  }

  // ─── Summary Cards ────────────────────────────────────────────────────

  async expectSummaryCards() {
    // Check for at least one metric label
    const metricLabels = this.page.getByText(/المساحة الإجمالية|Total Area|عدد القطع|Plots/i);
    await expect(metricLabels.first()).toBeVisible();
  }
}
