interface FakeMediaList {
  readonly media: string;
  readonly matches: boolean;
  readonly addEventListener: (type: string, listener: () => void) => void;
  readonly removeEventListener: (type: string, listener: () => void) => void;
}

export interface FakeViewport {
  readonly matchMedia: (query: string) => FakeMediaList;
  readonly resize: (width: number) => void;
}

export function fakeViewport(initialWidth: number): FakeViewport {
  let width = initialWidth;
  const listeners = new Set<() => void>();

  function matches(query: string): boolean {
    const match = /max-width: (\d+)px/.exec(query);
    const widest = Number(match?.[1]);
    return width <= widest;
  }

  function matchMedia(query: string): FakeMediaList {
    return {
      media: query,
      get matches() {
        return matches(query);
      },
      addEventListener: (_: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: () => void) => {
        listeners.delete(listener);
      },
    };
  }

  function resize(next: number): void {
    width = next;
    listeners.forEach((listener) => {
      listener();
    });
  }

  return { matchMedia, resize };
}
