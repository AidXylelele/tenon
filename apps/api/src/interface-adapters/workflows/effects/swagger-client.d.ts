declare module "swagger-client" {
  interface BuildRequestOptions {
    readonly spec: object;
    readonly operationId: string;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly requestBody: unknown;
    readonly contextUrl: string;
  }

  export interface BuiltRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: unknown;
  }

  const SwaggerClient: {
    buildRequest(options: BuildRequestOptions): BuiltRequest;
  };

  export default SwaggerClient;
}
