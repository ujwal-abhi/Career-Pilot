export type FunnelStage = "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER";

export interface FunnelStageCount {
  stage: FunnelStage;
  reached: number;
}

export interface FunnelStep {
  from: FunnelStage;
  to: FunnelStage;
  reached: number;
  of: number;
  rate: number | null;
  enoughData: boolean;
}

export interface Funnel {
  stages: FunnelStageCount[];
  steps: FunnelStep[];
  weakestStep: FunnelStep | null;
  savedOnlyCount: number;
  stageUnknownCount: number;
}

export interface WeekCount {
  weekStart: string;
  count: number;
}

export interface MatchByStage {
  stage: FunnelStage;
  applications: number;
  averageScore: number | null;
  lowSample: boolean;
}

export interface PracticeWeek {
  weekStart: string;
  attempts: number;
  passRate: number | null;
}

export interface AnalyticsData {
  totalApplications: number;
  minSample: number;
  funnel: Funnel;
  weeklyApplications: WeekCount[];
  matchByStage: MatchByStage[];
  practice: {
    totalAttempts: number;
    weekly: PracticeWeek[];
  };
  resume: {
    latestScore: number | null;
    analyzedAt: string | null;
  };
}