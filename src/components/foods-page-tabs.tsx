"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Apple, Activity, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { FoodExplorer } from "@/components/food-explorer";
import { MetsExplorer } from "@/components/mets-explorer";
import { FoodsManager } from "@/components/foods-manager";
import type { DbFood } from "@/lib/types";

export function FoodsPageTabs({ foods }: { foods: DbFood[] }) {
  const tn = useTranslations("nutrition");
  const tm = useTranslations("mets");
  const [tab, setTab] = useState<"mine" | "db" | "mets">("mine");

  return (
    <div>
      <div className="mb-4 inline-flex flex-wrap rounded-md border border-border bg-card p-0.5">
        <Tab active={tab === "mine"} onClick={() => setTab("mine")} icon={<Database className="size-4" />}>
          {tn("myFoods")}
        </Tab>
        <Tab active={tab === "db"} onClick={() => setTab("db")} icon={<Apple className="size-4" />}>
          {tn("builtInFoods")}
        </Tab>
        <Tab active={tab === "mets"} onClick={() => setTab("mets")} icon={<Activity className="size-4" />}>
          {tm("title")}
        </Tab>
      </div>
      {tab === "mine" && <FoodsManager foods={foods} />}
      {tab === "db" && <FoodExplorer />}
      {tab === "mets" && <MetsExplorer />}
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
