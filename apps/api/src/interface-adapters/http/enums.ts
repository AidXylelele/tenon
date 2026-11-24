export enum TransportFailure {
  Unreachable = "unreachable",
  Unauthenticated = "unauthenticated",
  Misconfigured = "misconfigured",
  Expired = "expired",
}

export enum BodyReading {
  ByMediaType = "by-media-type",
  Raw = "raw",
}
