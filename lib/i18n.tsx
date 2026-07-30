"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

export type Lang = "tr" | "en";

const LANG_KEY = "freelance-budget-lang";

type Dict = Record<string, string>;

const en: Dict = {
  app_name: "Freelance Cash Flow",
  nav_dashboard: "Dashboard",
  nav_history: "Income History",
  nav_log: "Transaction Log",
  sidebar_tip_title: "Cash-first budgeting",
  sidebar_tip_body: "You can only allocate money that's already in the account — never future invoices.",

  // Dashboard
  get_started_msg: "Get started by setting the cash currently in your account.",
  set_starting_balance: "Set starting balance",
  stale_income_title: "No income logged in {days} days.",
  stale_income_body:
    "Your category and savings balances below are accurate, but double-check nothing's been missed — irregular income means dry spells are normal, but it's worth keeping an eye on.",
  unallocated_cash: "Unused Cash",
  unallocated_cash_hint: "Free cash not yet assigned to any category",
  log_income: "+ Log income",
  allocate: "Log expense",
  recent_income: "Income",
  no_payments_yet: "No payments logged yet.",
  recent_expenses: "Expense",
  no_expenses_yet: "No expenses logged yet.",
  log_a_spend: "Log detailed expense",
  reallocate: "Reallocate between categories",
  manage_categories: "Manage categories",
  income_trend_title: "Income Trend (last 6 months)",
  avg_per_month: "Avg {amount}/mo",
  load_demo_data: "Load demo data",
  clear_all_data: "Clear all data",

  // Buffer card
  buffer_fund: "Savings",
  default_buffer_name: "Savings",
  status_healthy: "Healthy",
  status_low: "Low",
  status_critical: "Critical",
  status_no_target: "No Target Set",
  buffer_target_hint: "{balance} of {target} target ({months} month{plural} of expenses) — {pct}%",
  buffer_no_target_hint: "Set monthly targets on your categories to calculate a savings target.",
  buffer_critical_msg: "Your savings are critically low. Consider prioritizing contributions on your next high-income month.",
  contribute: "Contribute",
  draw: "Draw",

  // Category grid
  categories: "Categories",
  overspent: "Overspent",
  underfunded: "Underfunded",
  no_categories_yet: "No categories yet. Add one to start allocating cash.",
  cat_rent: "Rent",
  cat_taxes: "Taxes (set aside)",
  cat_groceries: "Groceries",
  cat_software: "Software & Subscriptions",

  // Income trend chart
  no_income_trend: "No income logged yet — trend will appear here.",
  income_trend_note:
    "Income varies month to month — this is exactly why savings matter: they smooth spending across the dry spells between payments.",

  // Profit trend chart
  profit_trend_title: "Profit (last 6 months)",
  no_profit_trend: "No income or expenses logged yet — profit will appear here.",
  profit_trend_note: "Profit is income minus expenses for each month — green means you came out ahead, red means you spent more than you earned.",

  // History page
  history_title: "Income History & Insights",
  history_subtitle: "Your income is irregular by nature — this view shows the pattern so you can set realistic targets.",
  avg_monthly_income: "Average monthly income",
  months_of_history: "Across {count} month(s) of history",
  best_month: "Best month",
  worst_month: "Worst month",
  no_data_yet: "No data yet",
  monthly_trend: "Monthly income trend",
  monthly_totals: "Monthly totals",
  payments_count: "{count} payment{plural}",
  best_badge: "Best",
  worst_badge: "Worst",
  no_income_yet: "No income logged yet.",

  // Log page
  log_title: "Transaction Log",
  log_subtitle: "Every dollar movement is an immutable, auditable event — balances are always derived from this log.",
  total_cash_on_hand: "Total cash on hand",
  no_transactions_yet: "No transactions yet.",
  type_initial_balance: "Starting balance",
  type_income: "Income",
  type_allocate: "Allocation",
  type_deallocate: "Un-allocation",
  type_transfer: "Transfer",
  type_spend: "Spend",
  type_adjustment: "Adjustment",
  account_unallocated: "Unallocated",
  account_buffer: "Savings",

  // Forms
  amount_received: "Amount received",
  client_or_source: "Client / source",
  date_received: "Date received",
  note_optional: "Note (optional)",
  invoice_placeholder: "e.g. Invoice #204",
  save_log_payment: "Log payment",
  category: "Category",
  amount_to_allocate: "Amount paid",
  date: "Date",
  available_amount: "Available: {amount}",
  from_category: "From category",
  to_category: "To category",
  amount: "Amount",
  move_money: "Move money",
  amount_spent: "Amount spent",
  what_was_this_for: "What was this for?",
  log_spend_btn: "Log spend",
  category_balance: "Category balance: {amount}",
  unallocated_available: "Unallocated cash available: {amount}",
  cover_shortfall_msg: "This spend is {shortfall} more than the category balance ({balance}). Cover the difference from:",
  cover_from_unallocated: "Unallocated cash ({amount} available)",
  cover_from_buffer: "Savings ({amount} available)",
  cancel: "Cancel",
  buffer_available: "Savings available: {amount}",
  cover_shortfall_in: "Cover shortfall in",
  amount_to_draw: "Amount to draw",
  reason_required: "Reason (required — kept in the log)",
  reason_placeholder: "e.g. Slow month, covering rent shortfall",
  draw_from_buffer: "Draw from savings",
  amount_to_contribute: "Amount to contribute",
  contribute_to_buffer: "Contribute to savings",
  category_name: "Category name",
  category_name_placeholder: "e.g. Health Insurance",
  monthly_target: "Monthly target",
  add_category: "Add category",
  balance_label: "Balance: {amount}",
  archive: "Delete",
  initial_balance_hint: "Enter the cash currently sitting in your account. This becomes your starting unallocated balance.",
  current_account_balance: "Current account balance",
  as_of_date: "As of date",
  set_balance: "Set balance",

  // Modal titles
  modal_income: "Log incoming payment",
  modal_allocate: "Log expense",
  modal_transfer: "Reallocate between categories",
  modal_spend: "Log detailed expense",
  modal_buffer_draw: "Draw from savings",
  modal_buffer_contribute: "Contribute to savings",
  modal_manage_categories: "Manage categories",
  modal_initial_balance: "Set starting balance",

  // Transaction labels (rendered from key+params)
  tx_initial_balance: "Starting cash on hand",
  tx_income: "Payment from {source}",
  tx_allocate: "Spent in {category}",
  tx_deallocate: "Moved back to unallocated from {category}",
  tx_transfer: "Reallocated {from} -> {to}",
  tx_spend: "Spent from {category}",
  tx_buffer_draw: "Savings draw -> {category}",
  tx_cover_shortfall: "Covered shortfall in {category} from {source}",

  // Errors
  err_income_amount: "Income amount must be greater than zero.",
  err_income_source: "Please enter a client or income source.",
  err_amount_positive: "Amount must be greater than zero.",
  err_category_not_found: "Category not found.",
  err_allocate_exceeds:
    "You only have {free} unallocated. Money can only be allocated if it physically exists in the account right now.",
  err_deallocate_exceeds: "{category} only has {balance} to move back.",
  err_transfer_same: "Source and destination must be different.",
  err_transfer_exceeds: "{category} only has {balance} available.",
  err_buffer_reason: "Please note why you're drawing from savings.",
  err_buffer_exceeds: "Savings only has {balance} available.",
  err_spend_amount: "Spend amount must be greater than zero.",
  err_spend_over:
    "{category} only has {balance}, this spend is {shortfall} over. Choose to cover the difference from unallocated cash or savings.",
  err_cover_insufficient: "Not enough in {source} ({available}) to cover the {shortfall} shortfall.",
  err_category_name_required: "Category name is required.",
  err_target_negative: "Target cannot be negative.",
  err_initial_balance_negative: "Starting balance cannot be negative.",
  source_unallocated: "unallocated cash",
  source_buffer: "savings",

  // Auth
  auth_sign_in: "Sign in",
  auth_sign_up: "Create account",
  auth_subtitle: "Your data is private to your account — no one else can see it.",
  auth_email: "Email",
  auth_password: "Password",
  auth_toggle_to_signup: "Don't have an account? Sign up",
  auth_toggle_to_signin: "Already have an account? Sign in",
  auth_check_email: "Check your inbox to confirm your email, then sign in.",
  sign_out: "Sign out",
  loading: "Loading…",
};

const tr: Dict = {
  app_name: "Serbest Çalışan Nakit Akışı",
  nav_dashboard: "Panel",
  nav_history: "Gelir Geçmişi",
  nav_log: "İşlem Kaydı",
  sidebar_tip_title: "Nakit öncelikli bütçeleme",
  sidebar_tip_body: "Yalnızca hesapta zaten bulunan parayı ayırabilirsiniz — gelecekteki faturaları asla değil.",

  get_started_msg: "Hesabınızda şu anda bulunan nakit tutarını girerek başlayın.",
  set_starting_balance: "Başlangıç bakiyesini ayarla",
  stale_income_title: "{days} gündür gelir kaydedilmedi.",
  stale_income_body:
    "Aşağıdaki kategori ve birikim bakiyeleri doğru, ama bir şeyin gözden kaçmadığından emin olun — düzensiz gelirde durgun dönemler normaldir, yine de takip etmekte fayda var.",
  unallocated_cash: "Kullanılmamış Nakit",
  unallocated_cash_hint: "Henüz hiçbir kategoriye atanmamış boş nakit",
  log_income: "+ Gelir kaydet",
  allocate: "Gider Kaydet",
  recent_income: "Gelir",
  no_payments_yet: "Henüz ödeme kaydedilmedi.",
  recent_expenses: "Gider",
  no_expenses_yet: "Henüz gider kaydedilmedi.",
  log_a_spend: "Detaylı Gider Kaydet",
  reallocate: "Kategoriler arasında aktar",
  manage_categories: "Kategorileri yönet",
  income_trend_title: "Gelir Trendi (son 6 ay)",
  avg_per_month: "Ort. {amount}/ay",
  load_demo_data: "Örnek veri yükle",
  clear_all_data: "Tüm verileri temizle",

  buffer_fund: "Birikim",
  default_buffer_name: "Birikim",
  status_healthy: "Sağlıklı",
  status_low: "Düşük",
  status_critical: "Kritik",
  status_no_target: "Hedef Belirlenmedi",
  buffer_target_hint: "{target} hedefinin {balance} tutarı dolduruldu ({months} aylık gider) — %{pct}",
  buffer_no_target_hint: "Bir birikim hedefi hesaplamak için kategorilerinize aylık hedefler belirleyin.",
  buffer_critical_msg: "Birikiminiz kritik derecede düşük. Bir sonraki yüksek gelirli ayda katkıyı önceliklendirin.",
  contribute: "Katkı ekle",
  draw: "Kullan",

  categories: "Kategoriler",
  overspent: "Fazla Harcandı",
  underfunded: "Yetersiz Fonlandı",
  no_categories_yet: "Henüz kategori yok. Nakit ayırmaya başlamak için bir tane ekleyin.",
  cat_rent: "Kira",
  cat_taxes: "Vergi (ayrılan)",
  cat_groceries: "Market",
  cat_software: "Yazılım & Abonelikler",

  no_income_trend: "Henüz gelir kaydedilmedi — trend burada görünecek.",
  income_trend_note:
    "Gelir aydan aya değişkenlik gösterir — birikimin önemli olmasının sebebi tam olarak budur: ödemeler arasındaki durgun dönemlerde harcamayı dengeler.",

  profit_trend_title: "Kâr (son 6 ay)",
  no_profit_trend: "Henüz gelir veya gider kaydedilmedi — kâr burada görünecek.",
  profit_trend_note: "Kâr, her ay için gelirden giderin çıkarılmasıyla hesaplanır — yeşil kârda olduğunuzu, kırmızı kazandığınızdan fazla harcadığınızı gösterir.",

  history_title: "Gelir Geçmişi ve Analiz",
  history_subtitle: "Geliriniz doğası gereği düzensiz — bu görünüm gerçekçi hedefler belirleyebilmeniz için düzeni gösterir.",
  avg_monthly_income: "Ortalama aylık gelir",
  months_of_history: "{count} aylık geçmiş verisine dayanıyor",
  best_month: "En iyi ay",
  worst_month: "En kötü ay",
  no_data_yet: "Henüz veri yok",
  monthly_trend: "Aylık gelir trendi",
  monthly_totals: "Aylık toplamlar",
  payments_count: "{count} ödeme",
  best_badge: "En iyi",
  worst_badge: "En kötü",
  no_income_yet: "Henüz gelir kaydedilmedi.",

  log_title: "İşlem Kaydı",
  log_subtitle: "Her para hareketi değiştirilemez, denetlenebilir bir olay olarak kaydedilir — bakiyeler her zaman bu kayıttan türetilir.",
  total_cash_on_hand: "Eldeki toplam nakit",
  no_transactions_yet: "Henüz işlem yok.",
  type_initial_balance: "Başlangıç bakiyesi",
  type_income: "Gelir",
  type_allocate: "Ayırma",
  type_deallocate: "Ayrımdan çıkarma",
  type_transfer: "Aktarım",
  type_spend: "Harcama",
  type_adjustment: "Düzeltme",
  account_unallocated: "Ayrılmamış",
  account_buffer: "Birikim",

  amount_received: "Alınan tutar",
  client_or_source: "Müşteri / kaynak",
  date_received: "Alınma tarihi",
  note_optional: "Not (isteğe bağlı)",
  invoice_placeholder: "örn. Fatura #204",
  save_log_payment: "Ödemeyi kaydet",
  category: "Kategori",
  amount_to_allocate: "Ödenen tutar",
  date: "Tarih",
  available_amount: "Kullanılabilir: {amount}",
  from_category: "Kaynak kategori",
  to_category: "Hedef kategori",
  amount: "Tutar",
  move_money: "Parayı taşı",
  amount_spent: "Harcanan tutar",
  what_was_this_for: "Bu ne içindi?",
  log_spend_btn: "Harcamayı kaydet",
  category_balance: "Kategori bakiyesi: {amount}",
  unallocated_available: "Kullanılabilir ayrılmamış nakit: {amount}",
  cover_shortfall_msg: "Bu harcama kategori bakiyesinden ({balance}) {shortfall} daha fazla. Farkı şuradan karşılayın:",
  cover_from_unallocated: "Ayrılmamış nakit ({amount} kullanılabilir)",
  cover_from_buffer: "Birikim ({amount} kullanılabilir)",
  cancel: "İptal",
  buffer_available: "Kullanılabilir birikim: {amount}",
  cover_shortfall_in: "Şu kategorideki açığı kapat",
  amount_to_draw: "Çekilecek tutar",
  reason_required: "Sebep (zorunlu — kayıtta tutulur)",
  reason_placeholder: "örn. Durgun ay, kira açığını kapatma",
  draw_from_buffer: "Birikimden çek",
  amount_to_contribute: "Katkı tutarı",
  contribute_to_buffer: "Birikime katkı yap",
  category_name: "Kategori adı",
  category_name_placeholder: "örn. Sağlık Sigortası",
  monthly_target: "Aylık hedef",
  add_category: "Kategori ekle",
  balance_label: "Bakiye: {amount}",
  archive: "Sil",
  initial_balance_hint: "Hesabınızda şu anda bulunan nakdi girin. Bu, başlangıç ayrılmamış bakiyeniz olacak.",
  current_account_balance: "Mevcut hesap bakiyesi",
  as_of_date: "Tarih itibarıyla",
  set_balance: "Bakiyeyi ayarla",

  modal_income: "Gelen ödeme kaydet",
  modal_allocate: "Gider kaydet",
  modal_transfer: "Kategoriler arasında aktar",
  modal_spend: "Detaylı Gider Kaydet",
  modal_buffer_draw: "Birikimden çek",
  modal_buffer_contribute: "Birikime katkı yap",
  modal_manage_categories: "Kategorileri yönet",
  modal_initial_balance: "Başlangıç bakiyesini ayarla",

  tx_initial_balance: "Hesaptaki başlangıç nakdi",
  tx_income: "{source} tarafından ödeme",
  tx_allocate: "{category} kategorisinde harcandı",
  tx_deallocate: "{category} kategorisinden ayrılmamışa taşındı",
  tx_transfer: "{from} kategorisinden {to} kategorisine aktarıldı",
  tx_spend: "{category} kategorisinden harcandı",
  tx_buffer_draw: "Birikimden {category} kategorisine çekildi",
  tx_cover_shortfall: "{category} kategorisindeki açık {source} kaynağından karşılandı",

  err_income_amount: "Gelir tutarı sıfırdan büyük olmalıdır.",
  err_income_source: "Lütfen bir müşteri veya gelir kaynağı girin.",
  err_amount_positive: "Tutar sıfırdan büyük olmalıdır.",
  err_category_not_found: "Kategori bulunamadı.",
  err_allocate_exceeds:
    "Sadece {free} tutarında ayrılmamış paranız var. Para, yalnızca hesapta fiilen mevcutsa bir kategoriye ayrılabilir.",
  err_deallocate_exceeds: "{category} kategorisinde geri taşınacak yalnızca {balance} var.",
  err_transfer_same: "Kaynak ve hedef farklı olmalıdır.",
  err_transfer_exceeds: "{category} kategorisinde yalnızca {balance} kullanılabilir.",
  err_buffer_reason: "Lütfen birikimden neden çektiğinizi belirtin.",
  err_buffer_exceeds: "Birikimde yalnızca {balance} kullanılabilir.",
  err_spend_amount: "Harcama tutarı sıfırdan büyük olmalıdır.",
  err_spend_over:
    "{category} kategorisinde yalnızca {balance} var, bu harcama {shortfall} fazla. Farkı ayrılmamış nakit veya birikimden karşılamayı seçin.",
  err_cover_insufficient: "{source} kaynağında {shortfall} açığı kapatmak için yeterli tutar yok (yalnızca {available} var).",
  err_category_name_required: "Kategori adı gereklidir.",
  err_target_negative: "Hedef negatif olamaz.",
  err_initial_balance_negative: "Başlangıç bakiyesi negatif olamaz.",
  source_unallocated: "ayrılmamış nakit",
  source_buffer: "birikim",

  // Auth
  auth_sign_in: "Giriş yap",
  auth_sign_up: "Hesap oluştur",
  auth_subtitle: "Verileriniz yalnızca hesabınıza özeldir — başka kimse göremez.",
  auth_email: "E-posta",
  auth_password: "Şifre",
  auth_toggle_to_signup: "Hesabınız yok mu? Kayıt olun",
  auth_toggle_to_signin: "Zaten hesabınız var mı? Giriş yapın",
  auth_check_email: "E-postanızı onaylamak için gelen kutunuzu kontrol edin, ardından giriş yapın.",
  sign_out: "Çıkış yap",
  loading: "Yükleniyor…",
};

const dictionaries: Record<Lang, Dict> = { en, tr };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[lang] ?? dictionaries.tr;
  let str = dict[key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

interface LanguageShape {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageShape | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_KEY);
      if (stored === "tr" || stored === "en") setLangState(stored);
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageShape {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
