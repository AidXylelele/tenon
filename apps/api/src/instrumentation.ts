import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Outbound calls go to endpoints authors chose: their URLs may carry credentials in the query,
// and they must not receive the platform's trace context, so undici is not instrumented.
const instrumentations = getNodeAutoInstrumentations({
  '@opentelemetry/instrumentation-undici': { enabled: false },
});
const sdk = new NodeSDK({ instrumentations: [instrumentations] });
sdk.start();

process.once('SIGTERM', () => void sdk.shutdown());
