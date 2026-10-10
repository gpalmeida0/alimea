"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, Apple, Database } from "lucide-react";
import { Segmented } from "@/components/ui/tabs";
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
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5"
        items={[
          { value: "mine", label: tn("myFoods"), icon: <Database />, badge: <span className="text-xs opacity-70">{foods.filter((f) => !f.archived).length}</span> },
          { value: "db", label: tn("builtInFoods"), icon: <Apple /> },
          { value: "mets", label: tm("title"), icon: <Activity /> },
        ]}
      />
      {tab === "mine" && <FoodsManager foods={foods} />}
      {tab === "db" && <FoodExplorer ownNames={foods.map((f) => f.name)} />}
      {tab === "mets" && <MetsExplorer />}
    </div>
  );
}
