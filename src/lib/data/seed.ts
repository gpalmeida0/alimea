import type {
  Appointment,
  Client,
  Consultation,
  DbFood,
  MealPlan,
  NutritionistProfile,
  PlanTemplate,
  Recommendation,
} from "@/lib/types";

// Default nutritionist (mirrors the supplied template branding).
export const seedProfile: NutritionistProfile = {
  id: "nutri-1",
  name: "Eduarda Carvalho",
  email: "eduardacarvalho.nutri@gmail.com",
  credential: "5084N",
  instagram: "@nutri_eduarda",
  phone: "910 175 422",
  address: "Rua S. Bartolomeu N45, Penafiel",
  logoUrl: "/pdf-assets/logo.png",
  interfaceLanguage: "pt-PT",
};

export const seedClients: Client[] = [
  {
    id: "client-1",
    nutritionistId: "nutri-1",
    name: "Gonçalo Almeida",
    email: "goncalo@example.com",
    phone: "911920299", // normalised to +351911920299 when texting
    birthDate: "1992-03-14",
    goals: "Recomposição corporal e melhoria de hábitos alimentares.",
    notes: "Treina 3x/semana. Sem alergias conhecidas.",
    createdAt: "2025-02-10T10:00:00Z",
  },
  {
    id: "client-2",
    nutritionistId: "nutri-1",
    name: "Miguel Santos",
    email: "miguel.santos@example.com",
    birthDate: "1988-07-02",
    goals: "Perda de massa gorda.",
    notes: "Intolerância à lactose.",
    createdAt: "2025-03-01T10:00:00Z",
  },
  {
    id: "client-3",
    nutritionistId: "nutri-1",
    name: "Sofia Almeida",
    email: "sofia.almeida@example.com",
    birthDate: "1995-11-20",
    goals: "Aumento de massa muscular.",
    createdAt: "2025-04-12T10:00:00Z",
  },
];

export const seedConsultations: Consultation[] = [
  {
    id: "consult-1a",
    clientId: "client-1",
    date: "2025-05-01",
    measurements: {
      weightKg: 55.4,
      heightM: 1.64,
      bodyFatPct: 23.0,
      muscleMassKg: 38.9,
      perimeters: { waist: 85.0, arm: 28.0, hip: 96.0, thigh: 56.0, calf: 36.0 },
      skinfolds: {
        tricipital: 19,
        subscapular: 21,
        bicipital: 36,
        iliocristal: 41,
        supraspinal: 82,
        abdominal: 92,
        geminal: 102,
        crural: 28,
      },
    },
    notes: "Boa adesão. Aumentar ingestão proteica ao pequeno-almoço.",
    planId: "plan-1a",
    createdAt: "2025-05-01T11:00:00Z",
  },
  {
    id: "consult-1b",
    clientId: "client-1",
    date: "2025-05-02",
    measurements: {
      weightKg: 54.0,
      heightM: 1.64,
      bodyFatPct: 22.1,
      muscleMassKg: 39.5,
      perimeters: { waist: 84.3, arm: 84.3, hip: 84.3, thigh: 84.3, calf: 84.3 },
      skinfolds: {
        tricipital: 18,
        subscapular: 20,
        bicipital: 35,
        iliocristal: 40,
        supraspinal: 80,
        abdominal: 90,
        geminal: 100,
        crural: 27,
      },
    },
    notes: "Evolução positiva no peso e massa muscular. Manter plano com ajustes.",
    planId: "plan-1b",
    createdAt: "2025-05-02T11:00:00Z",
  },
];

const eduardaMeals: MealPlan["meals"] = [
  {
    id: "m1",
    name: "Pequeno-Almoço",
    options: [
      { id: "o1", content: "1 pão de mistura + 1 fatia de queijo flamengo light" },
      { id: "o2", content: "crepioca (1 ovo + 40g tapioca) + 1 fatia de queijo magro" },
    ],
  },
  {
    id: "m2",
    name: "Merenda da Manhã",
    options: [
      { id: "o3", content: "1 pão de mistura + 1 fatia de queijo flamengo light" },
      { id: "o4", content: "crepioca (1 ovo + 40g tapioca) + 1 fatia de queijo magro" },
    ],
  },
  {
    id: "m3",
    name: "Almoço",
    options: [
      {
        id: "o5",
        content:
          "Deves iniciar com 1 prato de sopa de legumes, sem batata.\n• 1/2 prato com hortícolas cozinhados ou frios.\n• (110g) de arroz ou massa cozinhados (40g em cru) OU 1 batata média (120g)\n• 100gr de carne cozinhada (120g cru) OU 120g (145g) de pescado cozinhado OU 2 Ovos\nTemperos - máximo 1 c. sopa de azeite virgem extra/refeição, vinagre sidra, limão, alecrim, salsa fresca.\nSobremesa - 1 porção de fruta\nBebida - Água",
      },
    ],
  },
  {
    id: "m4",
    name: "Merenda da Tarde",
    options: [
      { id: "o6", content: "1 pão de mistura + 1 fatia de queijo flamengo light" },
      { id: "o7", content: "crepioca (1 ovo + 40g tapioca) + 1 fatia de queijo magro" },
    ],
  },
  {
    id: "m5",
    name: "Jantar",
    options: [
      {
        id: "o8",
        content:
          "Quantidades similares ao almoço, variar entre os métodos de confeção e o tipo de proteína.",
      },
    ],
  },
];

export const seedPlans: MealPlan[] = [
  {
    id: "plan-1a",
    clientId: "client-1",
    consultationId: "consult-1a",
    language: "pt-PT",
    meals: eduardaMeals,
    supplementation:
      "MAGNÉSIO INOSITOL RELAX\nmarca “now food” - 1 cápsula antes de dormir",
    notes:
      "12h de jejum noturno no mínimo.\np.ex. acabar de jantar às 20h00 e só tomar o pequeno-almoço às 08h00 da manhã.\n\n1 porção de fruta corresponde a 140g (3 ameixas / 2 fatias de ananás / cerejas / 2 kiwis / 1 laranja ou maçã média / 2 tangerinas).",
    motivationalQuote: "A persistência é o caminho do êxito",
    nextAppointment: "20 de maio às 14h00",
    createdAt: "2025-05-01T11:30:00Z",
    updatedAt: "2025-05-01T11:30:00Z",
  },
  {
    id: "plan-1b",
    clientId: "client-1",
    consultationId: "consult-1b",
    language: "pt-PT",
    meals: eduardaMeals,
    supplementation:
      "MAGNÉSIO INOSITOL RELAX\nmarca “now food” - 1 cápsula antes de dormir",
    notes:
      "12h de jejum noturno no mínimo.\np.ex. acabar de jantar às 20h00 e só tomar o pequeno-almoço às 08h00 da manhã.",
    motivationalQuote: "A persistência é o caminho do êxito",
    nextAppointment: "20 de maio às 14h00",
    createdAt: "2025-05-02T11:30:00Z",
    updatedAt: "2025-05-02T11:30:00Z",
  },
];

// A small starter food database (per 100 g / mL) the nutritionist can extend.
const food = (
  id: string,
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  category: string,
  baseUnit: "g" | "mL" = "g",
): DbFood => ({
  id,
  nutritionistId: "nutri-1",
  name,
  baseUnit,
  refQty: 100,
  kcal,
  protein,
  carbs,
  fat,
  category,
  archived: false,
  createdAt: "2025-01-01T00:00:00Z",
});

export const seedFoods: DbFood[] = [
  food("food-1", "Arroz cozido", 130, 2.7, 28, 0.3, "Cereais"),
  food("food-2", "Massa cozida", 158, 5.8, 31, 0.9, "Cereais"),
  food("food-3", "Batata cozida", 86, 1.7, 20, 0.1, "Tubérculos"),
  food("food-4", "Pão de mistura", 253, 8.5, 48, 1.5, "Cereais"),
  food("food-5", "Peito de frango grelhado", 165, 31, 0, 3.6, "Carne"),
  food("food-6", "Pescada cozida", 90, 18, 0, 1.8, "Pescado"),
  food("food-7", "Ovo cozido", 143, 13, 1.1, 9.5, "Ovos"),
  food("food-8", "Queijo flamengo light", 250, 26, 1, 16, "Lacticínios"),
  food("food-9", "Iogurte natural magro", 56, 5.7, 7.7, 0.2, "Lacticínios"),
  food("food-10", "Azeite virgem extra", 884, 0, 0, 100, "Gorduras", "mL"),
  food("food-11", "Maçã", 52, 0.3, 14, 0.2, "Fruta"),
  food("food-12", "Banana", 89, 1.1, 23, 0.3, "Fruta"),
  food("food-13", "Aveia em flocos", 389, 16.9, 66, 6.9, "Cereais"),
  food("food-14", "Leite meio-gordo", 47, 3.3, 4.8, 1.6, "Lacticínios", "mL"),
  food("food-15", "Tapioca", 358, 0.2, 88, 0, "Cereais"),
];

export const seedRecommendations: Recommendation[] = [
  {
    id: "rec-1",
    nutritionistId: "nutri-1",
    category: "hydration",
    title: "Hidratação diária",
    content: {
      "pt-PT": "Beber pelo menos 1,5 a 2L de água por dia, distribuída ao longo do dia.",
      en: "Drink at least 1.5 to 2L of water per day, spread throughout the day.",
    },
  },
  {
    id: "rec-2",
    nutritionistId: "nutri-1",
    category: "behavior",
    title: "Jejum noturno",
    content: {
      "pt-PT":
        "12h de jejum noturno no mínimo. P.ex. acabar de jantar às 20h00 e tomar o pequeno-almoço às 08h00.",
      en: "At least 12h overnight fasting. E.g. finish dinner at 8pm and have breakfast at 8am.",
    },
  },
  {
    id: "rec-3",
    nutritionistId: "nutri-1",
    category: "supplementation",
    title: "Magnésio ao deitar",
    content: {
      "pt-PT": "Magnésio inositol - 1 cápsula antes de dormir para apoio ao relaxamento.",
      en: "Magnesium inositol - 1 capsule before bed to support relaxation.",
    },
  },
  {
    id: "rec-4",
    nutritionistId: "nutri-1",
    category: "restrictions",
    title: "Limitar açúcar adicionado",
    content: {
      "pt-PT": "Evitar bebidas açucaradas e doces processados durante a semana.",
      en: "Avoid sugary drinks and processed sweets during the week.",
    },
  },
];

export const seedTemplates: PlanTemplate[] = [
  {
    id: "tpl-1",
    nutritionistId: "nutri-1",
    name: "Base equilibrada — 5 refeições",
    language: "pt-PT",
    meals: eduardaMeals,
    // These mirror reusable recommendations (rec-3 / rec-2) so applying the
    // template marks those recommendations as selected automatically.
    supplementation: "Magnésio inositol - 1 cápsula antes de dormir para apoio ao relaxamento.",
    notes: "12h de jejum noturno no mínimo. P.ex. acabar de jantar às 20h00 e tomar o pequeno-almoço às 08h00.",
  },
];

// Dates sit around "today" (mid-June 2026) so the calendar and the 24h reminder
// window demo realistically. The 2026-06-15 appointment is due for a reminder.
export const seedAppointments: Appointment[] = [
  {
    id: "appt-1",
    clientId: "client-1",
    date: "2026-06-15T14:00:00",
    durationMin: 45,
    note: "Reavaliação",
    status: "scheduled",
    reminderEnabled: true,
    reminderChannel: "sms",
  },
  {
    id: "appt-2",
    clientId: "client-2",
    date: "2026-06-18T10:30:00",
    durationMin: 30,
    note: "Consulta de seguimento",
    status: "scheduled",
    reminderEnabled: true,
    reminderChannel: "sms",
  },
  {
    id: "appt-3",
    clientId: "client-3",
    date: "2026-06-23T17:00:00",
    durationMin: 45,
    note: "Primeira consulta",
    status: "scheduled",
    reminderEnabled: true,
    reminderChannel: "sms",
  },
  {
    // Imminent appointment (~25 min from now) to showcase live notifications.
    id: "appt-5",
    clientId: "client-1",
    date: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    durationMin: 30,
    note: "Consulta de hoje",
    status: "scheduled",
    reminderEnabled: true,
    reminderChannel: "sms",
  },
  {
    id: "appt-4",
    clientId: "client-1",
    date: "2026-06-09T11:00:00",
    durationMin: 45,
    note: "Consulta realizada",
    status: "completed",
    reminderEnabled: true,
    reminderChannel: "sms",
    reminderSentAt: "2026-06-08T09:00:00",
  },
];
