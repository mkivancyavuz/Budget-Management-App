// Onboarding tour steps — plain data, no JSX.
//
// Targets are found through `data-tour` attributes rather than refs, so a
// component only carries one attribute and knows nothing about the tour. Moving
// a card to another file keeps the tour working; the attribute travels with it.
//
// The tour spans several pages, so each step names the route it belongs to and
// the provider navigates when the route changes between steps.

export type TourVisibility = "all" | "desktop" | "mobile";

export interface TourStep {
  /** Stable id, independent of ordering. */
  id: string;
  /** Value of the target's data-tour attribute. */
  target: string;
  /** Page this step is shown on. */
  route: string;
  titleKey: string;
  bodyKey: string;
  /** Preferred side for the bubble; flipped automatically when it won't fit. */
  placement: "top" | "bottom" | "left" | "right";
  /** The sidebar is desktop-only and the mobile header phone-only, so that idea
   * needs two entries with different targets. */
  showOn?: TourVisibility;
  /** Targets that may legitimately be absent (the debt card when there's no
   * debt, charts before any data exists) are stepped over instead of ending the
   * tour. */
  optional?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  // ---- Dashboard ----------------------------------------------------------
  {
    id: "cash",
    target: "unused-cash",
    route: "/",
    titleKey: "tour_cash_title",
    bodyKey: "tour_cash_body",
    placement: "bottom",
  },
  {
    id: "income",
    target: "log-income",
    route: "/",
    titleKey: "tour_income_title",
    bodyKey: "tour_income_body",
    placement: "bottom",
  },
  {
    id: "expense",
    target: "log-expense",
    route: "/",
    titleKey: "tour_expense_title",
    bodyKey: "tour_expense_body",
    placement: "bottom",
  },
  {
    id: "month-lists",
    target: "month-lists",
    route: "/",
    titleKey: "tour_month_title",
    bodyKey: "tour_month_body",
    placement: "bottom",
  },
  {
    id: "categories",
    target: "manage-categories",
    route: "/",
    titleKey: "tour_categories_title",
    bodyKey: "tour_categories_body",
    placement: "bottom",
  },
  {
    id: "distribution",
    target: "expense-distribution",
    route: "/",
    titleKey: "tour_distribution_title",
    bodyKey: "tour_distribution_body",
    placement: "top",
  },
  {
    id: "pie",
    target: "category-pie",
    route: "/",
    titleKey: "tour_pie_title",
    bodyKey: "tour_pie_body",
    placement: "top",
  },
  {
    id: "debt",
    target: "debt-card",
    route: "/",
    titleKey: "tour_debt_title",
    bodyKey: "tour_debt_body",
    placement: "top",
    optional: true,
  },
  // ---- Navigation ---------------------------------------------------------
  {
    id: "nav-desktop",
    target: "sidebar-nav",
    route: "/",
    titleKey: "tour_nav_title",
    bodyKey: "tour_nav_body",
    placement: "right",
    showOn: "desktop",
  },
  {
    id: "nav-mobile",
    target: "mobile-nav",
    route: "/",
    titleKey: "tour_nav_title",
    bodyKey: "tour_nav_body",
    placement: "bottom",
    showOn: "mobile",
  },
  // ---- Income history -----------------------------------------------------
  {
    id: "history",
    target: "history-summary",
    route: "/history",
    titleKey: "tour_history_title",
    bodyKey: "tour_history_body",
    placement: "bottom",
  },
  // ---- Transaction log ----------------------------------------------------
  {
    id: "log",
    target: "log-header",
    route: "/log",
    titleKey: "tour_log_title",
    bodyKey: "tour_log_body",
    placement: "bottom",
  },
  // ---- Profile ------------------------------------------------------------
  {
    id: "profile",
    target: "profile-identity",
    route: "/profile",
    titleKey: "tour_profile_title",
    bodyKey: "tour_profile_body",
    placement: "bottom",
  },
  {
    id: "currency",
    target: "currency-card",
    route: "/profile",
    titleKey: "tour_currency_title",
    bodyKey: "tour_currency_body",
    placement: "top",
  },
];

/** Steps that apply at the current breakpoint. The counter is built from this,
 * never from the raw list — otherwise a phone would show "3/14" while only
 * thirteen steps could ever run. */
export function stepsForViewport(isDesktop: boolean): TourStep[] {
  return TOUR_STEPS.filter((step) => {
    const show = step.showOn ?? "all";
    if (show === "all") return true;
    return show === (isDesktop ? "desktop" : "mobile");
  });
}
