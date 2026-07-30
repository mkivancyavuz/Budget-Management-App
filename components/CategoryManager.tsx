"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { categoryDisplayName } from "@/lib/ledger";
import { Button } from "./ui";
import { CategoryForm } from "./ActionForms";

export function CategoryManager() {
  const { state, updateCategory, archiveCategory } = useStore();
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const categories = state.categories.filter((c) => !c.archived);

  return (
    <div>
      <div className="space-y-2 mb-4">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-app-border px-3 py-2">
            <input
              className="flex-1 text-sm font-medium bg-transparent focus:outline-none text-app-text"
              value={categoryDisplayName(c, t)}
              onChange={(e) => updateCategory(c.id, { name: e.target.value, nameKey: undefined })}
            />
            <button
              onClick={() => archiveCategory(c.id)}
              className="text-xs text-app-text-muted hover:text-app-danger"
              title={t("archive")}
            >
              {t("archive")}
            </button>
          </div>
        ))}
      </div>
      {showAdd ? (
        <CategoryForm onDone={() => setShowAdd(false)} />
      ) : (
        <Button variant="secondary" onClick={() => setShowAdd(true)} className="w-full">
          + {t("add_category")}
        </Button>
      )}
    </div>
  );
}
