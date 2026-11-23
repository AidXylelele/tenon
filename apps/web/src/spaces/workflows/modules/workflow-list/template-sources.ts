import dailyDigest from "./templates/daily-digest.yaml";
import forwardWebhook from "./templates/forward-webhook.yaml";
import repeatForEach from "./templates/repeat-for-each.yaml";
import retryACall from "./templates/retry-a-call.yaml";
import routeByCondition from "./templates/route-by-condition.yaml";

export const TEMPLATE_SOURCES: Readonly<Record<string, string>> = {
  "daily-digest": dailyDigest,
  "forward-webhook": forwardWebhook,
  "route-by-condition": routeByCondition,
  "repeat-for-each": repeatForEach,
  "retry-a-call": retryACall,
};
