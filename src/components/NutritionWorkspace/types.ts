import type { DayTypeId } from '@/lib/nutritionRules';
import type { WorkspaceAthlete } from '@/lib/nutritionWorkspace';
import type { LibraryMeal } from '@/lib/queries/mealLibrary';
import type { RuleWithNames } from '@/lib/queries/nutritionRules';

export type PlanDTO = {
  ruleId: string;
  name: string;
  scope: 'group' | 'org_default';
  groupId: string | null;
  assignedCount: number;
  overrideCount: number;
  referenceMassKg: number | null;
  protein: number;
  /* One per day type. Replaced a single shared rate — see MacroRule. */
  carbByDay: Record<DayTypeId, number>;
  fat: number;
  fluid: number;
  energyCap: number | null;
  reason: string | null;
};

export type UnitGroupDTO = { unit: string; athleteIds: string[] };

export type { WorkspaceAthlete, RuleWithNames, LibraryMeal };
