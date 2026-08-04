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
  categories: "Expense Distribution",
  overspent: "Overspent",
  underfunded: "Underfunded",
  no_categories_yet: "No categories yet. Add one to start allocating cash.",
  cat_rent: "Rent",
  cat_taxes: "Taxes (set aside)",
  cat_groceries: "Groceries",
  cat_software: "Software & Subscriptions",

  // Income trend chart
  no_income_trend: "No income logged yet — trend will appear here.",

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
  transaction_count: "{count} transactions",
  type_initial_balance: "Starting balance",
  type_income: "Income",
  type_allocate: "Expense",
  type_deallocate: "Un-allocation",
  type_transfer: "Transfer",
  type_spend: "Spend",
  type_pay_credit_card: "Debt Payment",
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
  date_today: "Today",
  available_amount: "Available: {amount}",
  from_category: "From category",
  to_category: "To category",
  amount: "Amount",
  move_money: "Move money",
  amount_spent: "Amount spent",
  what_was_this_for: "What was this for?",
  log_spend_btn: "Log spend",
  category_balance: "Category balance: {amount}",
  unallocated_available: "Available cash: {amount}",
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
  edit: "Edit",
  edit_category: "Edit category",
  category_paid_amount: "Amount paid",
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
  tx_adjustment: "Adjusted amount in {category}",

  // Errors
  err_income_amount: "Income amount must be greater than zero.",
  err_income_source: "Please enter a client or income source.",
  err_amount_positive: "Amount must be greater than zero.",
  err_category_not_found: "Category not found.",
  err_allocate_exceeds:
    "You only have {free} unallocated. Money can only be allocated if it physically exists in the account right now.",
  err_pay_credit_card_insufficient_funds: "You only have {free} in available cash. Please add money to the account.",
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
  err_category_exists: "A category named “{name}” already exists.",
  err_future_date: "You can't use a future date — today is the latest.",
  err_target_negative: "Target cannot be negative.",
  err_initial_balance_negative: "Starting balance cannot be negative.",
  source_unallocated: "unallocated cash",
  source_buffer: "savings",

  // Auth
  auth_sign_in: "Sign in",
  auth_sign_up: "Create account",
  auth_subtitle: "Your data is private to your account — no one else can see it.",
  auth_email: "Email",
  username: "Username",
  username_placeholder: "e.g. mehmetk",
  err_username_required: "Username is required.",
  auth_password: "Password",
  auth_create_password: "Create a password",
  auth_confirm_password: "Confirm password",
  auth_forgot_password: "Forgot your password?",
  forgot_password_title: "Reset your password",
  forgot_password_subtitle: "Enter your email and we'll send you a link to set a new password.",
  forgot_password_submit: "Send reset link",
  forgot_password_sent: "If that address has an account, a reset link is on its way. Check your inbox.",
  reset_password_title: "Set a new password",
  reset_password_subtitle: "Choose a new password for your account.",
  reset_password_submit: "Save new password",
  reset_password_done: "Your password has been updated. You can sign in now.",
  back_to_login: "Back to sign in",
  err_reset_link_invalid: "This reset link is invalid or has expired. Request a new one.",
  auth_toggle_to_signup: "Create new account",
  auth_toggle_to_signin: "Sign in instead",
  auth_check_email: "Check your inbox to confirm your email, then sign in.",
  show_password: "Show password",
  hide_password: "Hide password",
  sign_out: "Sign out",
  sign_out_section_title: "Sign Out",
  sign_out_desc: "Sign out of your account on this device.",
  loading: "Loading…",
  profile_link: "My Profile",
  profile_title: "Profile",
  profile_subtitle: "Your account details.",
  profile_member_since: "Member since {date}",
  profile_edit_title: "Edit Profile",
  display_name: "Display name",
  display_name_placeholder: "Your name",
  save_changes: "Save changes",
  profile_saved: "Saved.",
  password_section_title: "Change Password",
  currency_section_title: "Currency",
  currency_section_desc: "Choose the currency amounts are shown in.",
  currency_try: "Turkish lira",
  currency_usd: "US dollar",
  currency_eur: "Euro",
  currency_no_conversion_hint:
    "This only changes the symbol — amounts are not converted at an exchange rate.",
  new_password: "New password",
  confirm_password: "Confirm new password",
  err_password_mismatch: "Passwords don't match.",
  err_password_short: "Password must be at least 6 characters.",
  password_saved: "Password updated.",
  avatar_section_title: "Profile Photo",
  avatar_upload: "Upload photo",
  avatar_uploading: "Uploading…",
  avatar_remove: "Remove photo",
  avatar_hint: "PNG, JPG, WebP or GIF, up to 2 MB.",
  avatar_no_photo_hint: "With no photo, your avatar shows these initials in the color you pick.",
  avatar_color: "Avatar color",
  avatar_initials: "Initials",
  avatar_initials_placeholder: "Auto",
  err_avatar_invalid_type: "That file type isn't supported. Use PNG, JPG, WebP or GIF.",
  err_avatar_too_large: "That image is larger than 2 MB.",
  err_avatar_failed: "Couldn't update the photo: {error}",
  danger_zone_title: "Caution",
  delete_account: "Delete Account",
  delete_account_desc:
    "Deleting your account permanently removes all your categories, transactions, and data. This cannot be undone.",
  delete_account_confirm_title: "Are you sure you want to delete your account?",
  delete_account_confirm_body: "This cannot be undone. Type your email to confirm: {email}",
  delete_account_confirm_placeholder: "Type your email",
  delete_account_confirm_password_body:
    "This cannot be undone. Enter your password twice to confirm you want to permanently delete your account and all its data.",
  delete_account_confirm_password_again: "Password (again)",
  delete_account_button: "Permanently delete my account",
  deleting: "Deleting…",
  err_delete_failed: "Failed to delete account: {error}",
  err_delete_wrong_password: "Incorrect password.",

  // Debt — when a spend/allocation exceeds what's actually on hand, the
  // shortfall is automatically carried here instead of blocking the entry.
  credit_card_debt_title: "Debt",
  credit_card_debt_hint: "Total spending covered beyond what was available, not yet paid back",
  no_debt: "No debt",
  pay_credit_card: "Pay Off Debt",
  modal_pay_credit_card: "Pay Off Debt",
  amount_to_pay: "Amount to pay",
  current_debt: "Current debt: {amount}",
  tx_pay_credit_card: "Debt payment",
  account_credit_card: "Debt",
  err_pay_exceeds_debt: "Your debt is only {debt}.",

  clear_all_confirm_title: "Are you sure?",
  clear_all_confirm_body:
    "All categories, transactions, and debt records will be permanently deleted. This cannot be undone.",
  confirm_clear: "Yes, clear everything",

  category_pie_title: "Expenses by Category",
  no_pie_data: "No expenses logged yet — the distribution will appear here.",
  total: "Total",

  pay_in_full: "Pay in Full",
  or_enter_amount: "or enter a specific amount",
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

  categories: "Gider Dağılımı",
  overspent: "Fazla Harcandı",
  underfunded: "Yetersiz Fonlandı",
  no_categories_yet: "Henüz kategori yok. Nakit ayırmaya başlamak için bir tane ekleyin.",
  cat_rent: "Kira",
  cat_taxes: "Vergi (ayrılan)",
  cat_groceries: "Market",
  cat_software: "Yazılım & Abonelikler",

  no_income_trend: "Henüz gelir kaydedilmedi — trend burada görünecek.",

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
  transaction_count: "{count} işlem",
  type_initial_balance: "Başlangıç bakiyesi",
  type_income: "Gelir",
  type_allocate: "Gider",
  type_deallocate: "Ayrımdan çıkarma",
  type_transfer: "Aktarım",
  type_spend: "Harcama",
  type_pay_credit_card: "Borç Ödemesi",
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
  date_today: "Bugün",
  available_amount: "Kullanılabilir: {amount}",
  from_category: "Kaynak kategori",
  to_category: "Hedef kategori",
  amount: "Tutar",
  move_money: "Parayı taşı",
  amount_spent: "Harcanan tutar",
  what_was_this_for: "Bu ne içindi?",
  log_spend_btn: "Harcamayı kaydet",
  category_balance: "Kategori bakiyesi: {amount}",
  unallocated_available: "Kullanılabilir nakit: {amount}",
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
  edit: "Düzenle",
  edit_category: "Kategoriyi düzenle",
  category_paid_amount: "Ödenen Tutar",
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
  tx_adjustment: "{category} kategorisinde tutar düzeltildi",
  tx_cover_shortfall: "{category} kategorisindeki açık {source} kaynağından karşılandı",

  err_income_amount: "Gelir tutarı sıfırdan büyük olmalıdır.",
  err_income_source: "Lütfen bir müşteri veya gelir kaynağı girin.",
  err_amount_positive: "Tutar sıfırdan büyük olmalıdır.",
  err_category_not_found: "Kategori bulunamadı.",
  err_allocate_exceeds:
    "Sadece {free} tutarında ayrılmamış paranız var. Para, yalnızca hesapta fiilen mevcutsa bir kategoriye ayrılabilir.",
  err_pay_credit_card_insufficient_funds: "Sadece {free} tutarında kullanılabilir nakdiniz var. Lütfen hesaba para ekleyin.",
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
  err_category_exists: "“{name}” adında bir kategori zaten var.",
  err_future_date: "İleri bir tarih giremezsiniz — en son bugünün tarihi olabilir.",
  err_target_negative: "Hedef negatif olamaz.",
  err_initial_balance_negative: "Başlangıç bakiyesi negatif olamaz.",
  source_unallocated: "ayrılmamış nakit",
  source_buffer: "birikim",

  // Auth
  auth_sign_in: "Giriş yap",
  auth_sign_up: "Hesap oluştur",
  auth_subtitle: "Verileriniz yalnızca hesabınıza özeldir — başka kimse göremez.",
  auth_email: "E-posta",
  username: "Kullanıcı adı",
  username_placeholder: "örn. mehmetk",
  err_username_required: "Kullanıcı adı gereklidir.",
  auth_password: "Şifre",
  auth_create_password: "Şifre oluşturun",
  auth_confirm_password: "Şifreyi onaylayın",
  auth_forgot_password: "Şifreni mi unuttun?",
  forgot_password_title: "Şifreni sıfırla",
  forgot_password_subtitle: "E-posta adresini gir, yeni şifre belirlemen için bir bağlantı gönderelim.",
  forgot_password_submit: "Sıfırlama bağlantısı gönder",
  forgot_password_sent: "Bu adrese ait bir hesap varsa sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.",
  reset_password_title: "Yeni şifre belirle",
  reset_password_subtitle: "Hesabın için yeni bir şifre seç.",
  reset_password_submit: "Yeni şifreyi kaydet",
  reset_password_done: "Şifren güncellendi. Artık giriş yapabilirsin.",
  back_to_login: "Girişe dön",
  err_reset_link_invalid: "Bu sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin.",
  auth_toggle_to_signup: "Yeni hesap oluştur",
  auth_toggle_to_signin: "Giriş yap",
  auth_check_email: "E-postanızı onaylamak için gelen kutunuzu kontrol edin, ardından giriş yapın.",
  show_password: "Şifreyi göster",
  hide_password: "Şifreyi gizle",
  sign_out: "Çıkış yap",
  sign_out_section_title: "Çıkış Yap",
  sign_out_desc: "Bu cihazda hesabından çıkış yap.",
  loading: "Yükleniyor…",
  profile_link: "Profilim",
  profile_title: "Profil",
  profile_subtitle: "Hesap bilgilerin.",
  profile_member_since: "Üyelik tarihi: {date}",
  profile_edit_title: "Profili Düzenle",
  display_name: "Görünen ad",
  display_name_placeholder: "Adınız",
  save_changes: "Kaydet",
  profile_saved: "Kaydedildi.",
  password_section_title: "Şifre Değiştir",
  currency_section_title: "Para Birimi",
  currency_section_desc: "Tutarların hangi para biriminde gösterileceğini seç.",
  currency_try: "Türk lirası",
  currency_usd: "Amerikan doları",
  currency_eur: "Euro",
  currency_no_conversion_hint:
    "Bu yalnızca sembolü değiştirir — tutarlar kur üzerinden çevrilmez.",
  new_password: "Yeni şifre",
  confirm_password: "Yeni şifre (tekrar)",
  err_password_mismatch: "Şifreler eşleşmiyor.",
  err_password_short: "Şifre en az 6 karakter olmalı.",
  password_saved: "Şifre güncellendi.",
  avatar_section_title: "Profil Fotoğrafı",
  avatar_upload: "Fotoğraf yükle",
  avatar_uploading: "Yükleniyor…",
  avatar_remove: "Fotoğrafı kaldır",
  avatar_hint: "PNG, JPG, WebP veya GIF, en fazla 2 MB.",
  avatar_no_photo_hint: "Fotoğraf yoksa avatarın, seçtiğin renkte bu baş harfleri gösterir.",
  avatar_color: "Avatar rengi",
  avatar_initials: "Baş harfler",
  avatar_initials_placeholder: "Otomatik",
  err_avatar_invalid_type: "Bu dosya türü desteklenmiyor. PNG, JPG, WebP veya GIF kullan.",
  err_avatar_too_large: "Bu resim 2 MB'tan büyük.",
  err_avatar_failed: "Fotoğraf güncellenemedi: {error}",
  danger_zone_title: "DİKKAT",
  delete_account: "Hesabı Sil",
  delete_account_desc:
    "Hesabını sildiğinde tüm kategorilerin, işlemlerin ve verilerin kalıcı olarak silinir. Bu işlem geri alınamaz.",
  delete_account_confirm_title: "Hesabını silmek istediğine emin misin?",
  delete_account_confirm_body: "Bu işlem geri alınamaz. Onaylamak için e-posta adresini yaz: {email}",
  delete_account_confirm_placeholder: "E-posta adresini yaz",
  delete_account_confirm_password_body:
    "Bu işlem geri alınamaz. Hesabını ve tüm verilerini kalıcı olarak silmek istediğini onaylamak için şifreni iki kez gir.",
  delete_account_confirm_password_again: "Şifre (tekrar)",
  delete_account_button: "Hesabımı kalıcı olarak sil",
  deleting: "Siliniyor…",
  err_delete_failed: "Hesap silinemedi: {error}",
  err_delete_wrong_password: "Şifre hatalı.",

  // Borç — bir harcama/ayırma eldeki tutardan fazlaysa, aradaki fark
  // engellenmek yerine otomatik olarak buraya yazılır.
  credit_card_debt_title: "Borç",
  credit_card_debt_hint: "Eldeki tutarın üzerinde yapılan, henüz geri ödenmemiş harcamaların toplamı",
  no_debt: "Borç yok",
  pay_credit_card: "Borcu Öde",
  modal_pay_credit_card: "Borcu Öde",
  amount_to_pay: "Ödenecek tutar",
  current_debt: "Güncel borç: {amount}",
  tx_pay_credit_card: "Borç ödemesi yapıldı",
  account_credit_card: "Borç",
  err_pay_exceeds_debt: "Borcunuz sadece {debt}.",

  clear_all_confirm_title: "Emin misiniz?",
  clear_all_confirm_body:
    "Tüm kategoriler, işlemler ve borç kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.",
  confirm_clear: "Evet, temizle",

  category_pie_title: "Kategorilere Göre Giderler",
  no_pie_data: "Henüz gider kaydedilmedi — dağılım burada görünecek.",
  total: "Toplam",

  pay_in_full: "Tamamını Öde",
  or_enter_amount: "veya belirli bir tutar girin",
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
