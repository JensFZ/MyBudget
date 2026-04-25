/**
 * Shape every locale file must satisfy.
 * months_short / months_long are string arrays; all other keys are strings.
 * Variable interpolation uses {varName} syntax.
 */
export type TranslationSet = {
  months_short: string[];
  months_long: string[];
  [key: string]: string | string[];
};

/** Metadata shown in the language picker. */
export type LocaleMeta = {
  /** Name of the language in its own language, e.g. "Deutsch", "English" */
  nativeName: string;
};
