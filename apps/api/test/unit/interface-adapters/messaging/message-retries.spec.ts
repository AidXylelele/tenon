import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { MessageRetries } from "../../../../src/interface-adapters/messaging/message-retries.js";
import { aHandlerContext } from "../../../support/outbox.js";

describe("the retries of an outbox message", () => {
  const retries = new MessageRetries();

  it.each([
    [MessageTopic.RunFail, 5],
    [MessageTopic.CancelRequested, 5],
    [MessageTopic.EventOffered, 5],
    [MessageTopic.ChildrenAbandoned, 5],
    [MessageTopic.RunBegin, 10],
    [MessageTopic.RunEffect, 10],
    [MessageTopic.DeliveryRequested, 36],
    ["mail.invitation", 36],
  ])("a_message_on_%s_is_tried_%i_times", (topic, attempts) => {
    const last = aHandlerContext(topic, "consumer", attempts);
    const before = aHandlerContext(topic, "consumer", attempts - 1);

    expect(retries.attemptsOf(topic)).toBe(attempts);
    expect(retries.retriesAfter(attempts - 1, topic)).toBe(true);
    expect(retries.retriesAfter(attempts, topic)).toBe(false);
    expect(retries.exhausted(last)).toBe(true);
    expect(retries.exhausted(before)).toBe(false);
    expect(retries.most).toBeGreaterThanOrEqual(attempts);
  });

  it("a_short_command_gives_up_within_a_minute", () => {
    const topic = MessageTopic.RunFail;
    const attempts = retries.attemptsOf(topic);
    const delays = Array.from({ length: attempts - 1 }, (_, index) =>
      retries.delayAfter(index + 1, topic),
    );
    const waited = delays.reduce((total, delay) => total + delay, 0);

    expect(waited).toBeLessThan(60_000);
  });

  it.each([
    [MessageTopic.RunBegin, 60_000],
    [MessageTopic.DeliveryRequested, 3_600_000],
  ])("a_delay_on_%s_never_passes_%i_ms", (topic, cap) => {
    const delay = retries.delayAfter(30, topic);

    expect(delay).toBeLessThanOrEqual(cap);
    expect(delay).toBeGreaterThanOrEqual(cap / 2);
  });
});
