// TypeScript shapes for Dashboard API responses
export type Point = { date: string; [k: string]: string | number };

export type Kpis = {
  activeUsers: number; 
  newUsers: number; 
  mrr: number; 
  churnRatePct: number; 
  avgMessagesPerSession: number;
};

export type UsersSeries = { 
  series: { date: string; newUsers: number; activeUsers: number }[] 
};

export type MessagesSeries = { 
  series: Point[] 
};

export type SubsOverview = {
  active: number; 
  newInRange: number; 
  churnedInRange: number;
  planDistribution: { plan_name: string; count: number }[];
  mrr: number; 
  arr: number;
};

export type SubsSeries = { 
  series: { date: string; new: number; churned: number }[] 
};

export type RevenueSeries = { 
  series: { date: string; mrr: number }[] 
};

export type SessionLength = { 
  avg: number; 
  p50: number; 
  p90: number 
};

export type RoleRatio = { 
  user: number; 
  assistant: number 
};

export type CharactersSummary = {
  totalCharacters: number; 
  avgPerUser: number;
  byGender: { gender: string; count: number }[];
  topStyles: { style: string; count: number }[];
  byCountry: { country: string; count: number }[];
};

export type MediaUsage = {
  characterImages: number;
  voice: { inputCount: number; outputCount: number; pctOfMessages: number };
};

export type Funnel = { 
  registered: number; 
  verified: number; 
  subscribed: number 
};

export type RetentionCohorts = { 
  cohorts: { cohort: string; size: number; d7_retainedPct: number; d14_retainedPct: number }[] 
};

export type VerificationLogin = { 
  verificationRatePct: number; 
  loginMethods: { method: string; count: number }[] 
};

export type Heatmap = { 
  matrix: { weekday: number; hour: number; messages: number }[] 
};

export type Geography = { 
  byCharacters: { country: string; count: number }[] 
};

export type ModelAvailability = { 
  chatModels: number; 
  imageModels: number; 
  speechModels: number 
};

export type ContentTrends = { 
  styles: { style: string; count: number }[] 
};

export type PromoSummary = {
  totalCoupons: number;
  byStatus: { status: string; count: number }[];
  totalRedemptions: number; 
  discountGiven: number;
  topPromos: { promo_code: string; redemptions: number; discount: number }[];
};

export type RedemptionsSeries = { 
  series: { date: string; redemptions: number; discount: number }[] 
};

export type FreePaid = { 
  free: number; 
  paid: number 
};

export type ARPULTV = { 
  arpu: number; 
  ltv: number 
};

export type PaidConversion = { 
  newUsers: number; 
  newSubscribers: number; 
  conversionPct: number 
};

// Date range context type
export interface DateRangeContextType {
  from: string;
  to: string;
  setDateRange: (from: string, to: string) => void;
}
