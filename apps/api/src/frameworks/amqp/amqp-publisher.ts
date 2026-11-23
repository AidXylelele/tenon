import type {
  ChannelModel,
  ConfirmChannel,
  RecoveringChannelModel,
} from "amqplib";

export class AmqpPublisher {
  #channel: Promise<ConfirmChannel>;

  constructor(private readonly model: RecoveringChannelModel) {
    model.on("connect", (connected: ChannelModel) => {
      this.#channel = this.#channelOn(connected);
    });
  }

  channel(): Promise<ConfirmChannel> {
    return this.#channel;
  }

  close(): Promise<void> {
    return this.model.close();
  }

  #channelOn(connected: ChannelModel): Promise<ConfirmChannel> {
    const opening = connected.createConfirmChannel();
    const reopen = () => {
      this.#channel = this.#channelOn(connected);
    };
    const opened = (channel: ConfirmChannel) => {
      channel.on("error", reopen);
    };
    const refused = () => undefined;
    void opening.then(opened, refused);
    return opening;
  }
}
