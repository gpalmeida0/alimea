"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Apple, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { FoodExplorer } from "@/components/food-explorer";
import { MetsExplorer } from "@/components/mets-explorer";

export function NutritionTabs() {
  const t = useTranslations("foods");
  const tm = useTranslations("mets");
  const [tab, setTab] = useState<"foods" | "mets">("foods");

  return (
    <div>
      <div className="mb-4 inline-flex rounded-md border border-border bg-card p-0.5">
        <Tab active={tab === "foods"} onClick={() => setTab("foods")} icon={<Apple className="size-4" />}>
          {t("title")}
        </Tab>
        <Tab active={tab === "mets"} onClick={() => setTab("mets")} icon={<Activity className="size-4" />}>
          {tm("title")}
        </Tab>
      </div>
      {tab === "foods" ? <FoodExplorer /> : <MetsExplorer />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
