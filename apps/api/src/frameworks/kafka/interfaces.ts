import type {
  Consumer,
  MessagesStream,
  MessageToProduce,
  Producer,
} from "@platformatic/kafka";

export type KafkaProducer = Producer<Buffer, Buffer, string, string>;

export type KafkaConsumer = Consumer<Buffer, Buffer, string, string>;

export type KafkaStream = MessagesStream<Buffer, Buffer, string, string>;

export type KafkaRecord = MessageToProduce<Buffer, Buffer, string, string>;
