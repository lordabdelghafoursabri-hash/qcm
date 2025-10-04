
export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Level {
  id: number;
  levelNumber: number;
  questions: Question[];
}

export interface Specialization {
  id: string;
  name: string;
  levels: Level[];
  specializations?: Specialization[];
}

export interface Category {
  id: string;
  name: string;
  specializations: Specialization[];
}

export interface Progress {
  [specializationId: string]: {
    [levelId: number]: number; // Store best score for each level
  };
}

export enum AppScreen {
  Home,
  Specializations,
  SubSpecializations,
  Levels,
  Quiz,
  Result,
  Stats,
}

export type AppState = {
  screen: AppScreen;
  categoryId?: string;
  specializationId?: string;
  levelId?: number;
  score?: number;
  userAnswers?: (number | null)[];
  reviewMode?: boolean;
};
