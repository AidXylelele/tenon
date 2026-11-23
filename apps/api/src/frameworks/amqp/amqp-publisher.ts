import type {
  ChannelModel,
  ConfirmChannel,
  RecoveringChannelModel,
} from "amqplib";

export class AmqpPublisher {
  private confirmChannel: Promise<ConfirmChannel>;

  constructor(private readonly model: RecoveringChannelModel) {
    model.on("connect", (connected: ChannelModel) => {
      this.confirmChannel = this.#channelOn(connected);
    });
  }

  channel(): Promise<ConfirmChannel> {
    return this.confirmChannel;
  }

  close(): Promise<void> {
    return this.model.close();
  }

  #channelOn(connected: ChannelModel): Promise<ConfirmChannel> {
    const opening = connected.createConfirmChannel();
    const reopen = () => {
      this.confirmChannel = this.#channelOn(connected);
    };
    const opened = (channel: ConfirmChannel) => {
      channel.on("error", reopen);
    };
    const refused = () => undefined;
    void opening.then(opened, refused);
    return opening;
  }
}
