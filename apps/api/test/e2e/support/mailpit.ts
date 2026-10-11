export class Mailpit {
  private readonly created: string[] = [];

  constructor(private readonly baseUrl: string) {}

  async linkFor(
    to: string,
    pattern: RegExp,
    timeoutMs = 15_000,
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const search = (await (
        await fetch(
          `${this.baseUrl}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
        )
      ).json()) as {
        messages?: { ID: string }[];
      };
      const id = search.messages?.[0]?.ID;
      if (id) {
        this.created.push(id);
        const message = (await (
          await fetch(`${this.baseUrl}/api/v1/message/${id}`)
        ).json()) as { Text: string };
        const link = message.Text.match(pattern)?.[0];
        if (link) {
          return link;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`No message for ${to} within ${timeoutMs} ms`);
  }

  async cleanup(): Promise<void> {
    if (this.created.length === 0) return;
    await fetch(`${this.baseUrl}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: this.created }),
    });
    this.created.length = 0;
  }
}
