import { checkAttributeNames } from "./attribute-names.js";
import { checkBinders } from "./binders.js";
import { checkCapabilities } from "./capabilities.js";
import { checkCron } from "./cron.js";
import { checkDuplicateDefaults } from "./duplicate-defaults.js";
import { checkDurations } from "./durations.js";
import { checkEmptyValues } from "./empty-values.js";
import { checkExpressionLanguage } from "./expression-language.js";
import { checkExpressions } from "./expressions.js";
import { checkGrpcAuthentication } from "./grpc-authentication.js";
import { checkJsonSchemas } from "./json-schemas.js";
import { checkRegexes } from "./regexes.js";
import { checkSecrets } from "./secrets.js";
import type { Check } from "./types.js";

export const checks: readonly Check[] = [
  checkExpressionLanguage,
  checkExpressions,
  checkBinders,
  checkDuplicateDefaults,
  checkDurations,
  checkCron,
  checkRegexes,
  checkJsonSchemas,
  checkSecrets,
  checkAttributeNames,
  checkEmptyValues,
  checkCapabilities,
  checkGrpcAuthentication,
];
