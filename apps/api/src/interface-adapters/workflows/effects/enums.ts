export enum RefusalCode {
  Address = "ERR_ADDRESS_REFUSED",
  ResponseSize = "ERR_RESPONSE_TOO_LARGE",
  Token = "ERR_TOKEN_REFUSED",
}

export enum BrokerProtocol {
  Amqp = "amqp",
  Amqps = "amqps",
  Kafka = "kafka",
  KafkaSecure = "kafka-secure",
  Mqtt = "mqtt",
  Mqtt5 = "mqtt5",
  SecureMqtt = "secure-mqtt",
  Nats = "nats",
  Redis = "redis",
}
