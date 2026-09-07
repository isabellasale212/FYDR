/* Types for scratch-guard.mjs. scripts/**\/*.mjs is excluded from tsconfig, so a
   .ts script importing it needs this alongside.

   THE REFS ARE TYPED `string` AND NOT AS LITERALS ON PURPOSE. As literal types
   tsc narrows `SCRATCH_REF !== PRODUCTION_REF` to a comparison of two disjoint
   literals and errors on it as "unintentional" — which would delete the one
   assertion that proves the two constants have not been set to the same value.
   That assertion is the floor under every other check in the guard's test. */

export declare const SCRATCH_REF: string;
export declare const PRODUCTION_REF: string;

export type TargetVerdict = {
  namesScratch: boolean;
  namesProduction: boolean;
  /** Safe for a destructive scratch-only write. */
  ok: boolean;
  /** Why not, in words a person reading a refusal needs. Empty when ok. */
  reason: string;
};

export declare function describeTarget(url: string | undefined | null): TargetVerdict;
