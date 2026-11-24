import { AddressPolicy } from "../../../../src/frameworks/http/address-policy.js";
import { BrokerConnections } from "../../../../src/frameworks/asyncapi/broker-connections.js";
import type {
  BrokerServer,
  Login,
  Lost,
} from "../../../../src/frameworks/asyncapi/interfaces.js";

interface Connection {
  readonly address: string;
  readonly lost: Lost;
}

const KEPT = 64;
const ANONYMOUS = null;
const LOGIN: Login = {
  username: "ada",
  password: "lovelace",
};

function serverAt(hostname: string): BrokerServer {
  return {
    url: `redis://${hostname}:6379`,
    hostname,
    port: 6379,
    pathname: "",
    secure: false,
  };
}

describe("the broker connections a host keeps", () => {
  const server = serverAt("127.0.0.1");
  let closed: Connection[];
  let connections: BrokerConnections<Connection>;

  const opened = (address: string, lost: Lost) =>
    Promise.resolve({ address, lost });

  beforeEach(() => {
    closed = [];
    connections = new BrokerConnections(
      new AddressPolicy(["127.0.0.1"]),
      (connection) => {
        closed.push(connection);
        return Promise.resolve();
      },
    );
  });

  it("calls_to_one_server_with_one_login_share_a_connection", async () => {
    const open = vi.fn(opened);

    const first = await connections.of(server, "", LOGIN, open);
    const second = await connections.of(server, "", LOGIN, open);

    expect(second).toBe(first);
    expect(open).toHaveBeenCalledOnce();
    expect(first.address).toBe("127.0.0.1");
  });

  it("calls_that_open_together_wait_for_the_one_opening", async () => {
    const open = vi.fn(opened);

    const [first, second] = await Promise.all([
      connections.of(server, "", LOGIN, open),
      connections.of(server, "", LOGIN, open),
    ]);

    expect(second).toBe(first);
    expect(open).toHaveBeenCalledOnce();
  });

  it("another_login_opens_its_own_connection", async () => {
    const open = vi.fn(opened);

    const anonymous = await connections.of(server, "", ANONYMOUS, open);
    const login = await connections.of(server, "", LOGIN, open);

    expect(login).not.toBe(anonymous);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("another_server_with_the_same_login_opens_its_own_connection", async () => {
    const open = vi.fn(opened);
    const other = serverAt("8.8.8.8");

    const first = await connections.of(server, "", LOGIN, open);
    const second = await connections.of(other, "", LOGIN, open);

    expect(second).not.toBe(first);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("another_variant_or_transport_security_on_one_url_opens_its_own_connection", async () => {
    const open = vi.fn(opened);
    const secure = { ...server, secure: true };

    const plain = await connections.of(server, "4", LOGIN, open);
    const five = await connections.of(server, "5", LOGIN, open);
    const tls = await connections.of(secure, "4", LOGIN, open);

    expect(five).not.toBe(plain);
    expect(tls).not.toBe(plain);
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("an_opening_that_fails_is_not_kept_and_the_next_call_opens_again", async () => {
    const open = vi
      .fn(opened)
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"));

    const failed = connections.of(server, "", LOGIN, open);

    await expect(failed).rejects.toThrow("connect ECONNREFUSED");
    await expect(
      connections.of(server, "", LOGIN, open),
    ).resolves.toMatchObject({
      address: "127.0.0.1",
    });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("a_lost_connection_is_closed_and_the_next_call_opens_a_new_one", async () => {
    const open = vi.fn(opened);
    const first = await connections.of(server, "", LOGIN, open);

    first.lost();
    const second = await connections.of(server, "", LOGIN, open);

    expect(second).not.toBe(first);
    expect(closed).toEqual([first]);
  });

  it("a_connection_lost_as_it_opens_is_closed_and_refused", async () => {
    const open = (address: string, lost: Lost) => {
      lost();
      return opened(address, lost);
    };

    const opening = connections.of(server, "", LOGIN, open);

    await expect(opening).rejects.toThrow(
      "The broker connection ended as it opened",
    );
    expect(closed).toHaveLength(1);
  });

  it("the_late_loss_of_an_evicted_connection_leaves_its_successor_kept", async () => {
    const others = Array.from({ length: KEPT }, (_, index) => ({
      username: `user-${String(index)}`,
      password: "p",
    }));
    const first = await connections.of(server, "", ANONYMOUS, opened);

    for (const login of others) await connections.of(server, "", login, opened);

    const successor = await connections.of(server, "", ANONYMOUS, opened);
    first.lost();
    const kept = await connections.of(server, "", ANONYMOUS, opened);

    expect(closed[0]).toBe(first);
    expect(successor).not.toBe(first);
    expect(kept).toBe(successor);
  });

  it("a_server_on_a_refused_address_is_never_opened", async () => {
    const open = vi.fn(opened);
    const refused = serverAt("10.0.0.1");

    const opening = connections.of(refused, "", LOGIN, open);

    await expect(opening).rejects.toThrow(
      "The address is private, loopback or link-local and not allow-listed",
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("closing_closes_every_kept_connection_and_waits_for_each", async () => {
    let finish: () => void = () => undefined;
    const finishing = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const slow = new BrokerConnections<Connection>(
      new AddressPolicy(["127.0.0.1"]),
      (connection) => {
        closed.push(connection);
        return finishing;
      },
    );
    const kept = await slow.of(server, "", LOGIN, opened);
    let done = false;

    const closing = slow.close().then(() => {
      done = true;
    });
    await Promise.resolve();

    expect(closed).toEqual([kept]);
    expect(done).toBe(false);
    finish();
    await closing;
    expect(done).toBe(true);
  });

  it("a_connection_that_opens_after_closing_began_is_closed_when_it_arrives", async () => {
    const pending: { arrive?: (connection: Connection) => void } = {};
    const open = () =>
      new Promise<Connection>((resolve) => {
        pending.arrive = resolve;
      });

    const opening = connections.of(server, "", LOGIN, open);
    await vi.waitFor(() => {
      expect(pending.arrive).toBeDefined();
    });
    await connections.close();
    const late = { address: "127.0.0.1", lost: () => undefined };
    pending.arrive?.(late);

    await expect(opening).rejects.toThrow();
    await vi.waitFor(() => {
      expect(closed).toEqual([late]);
    });
  });

  it("a_dedicated_connection_is_opened_for_each_call_and_never_kept", async () => {
    const open = vi.fn((address: string) => Promise.resolve({ address }));

    const first = await connections.dedicated(server, open);
    const second = await connections.dedicated(server, open);

    expect(second).not.toBe(first);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
