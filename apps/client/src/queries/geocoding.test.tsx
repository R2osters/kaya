import { queryKeys } from "@kaya/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import {
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  useAddressSearch,
  useDebouncedValue,
} from "./geocoding";

const mockSearchAddresses = jest.fn();

jest.mock("../api/client", () => ({
  api: { searchAddresses: (...args: unknown[]) => mockSearchAddresses(...args) },
}));

const OSU = {
  label: "Osu, Accra, Ghana",
  name: "Osu",
  city: "Accra",
  countryCode: "GH",
  lat: 5.5606,
  lng: -0.1824,
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function setup(initialText: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = renderHook(({ text }: { text: string }) => useAddressSearch(text), {
    wrapper: wrapper(queryClient),
    initialProps: { text: initialText },
  });
  return { ...rendered, queryClient };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockSearchAddresses.mockReset().mockResolvedValue([OSU]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("holds the previous value until the delay passes", () => {
    const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "ab" });
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("ab");
  });

  it("restarts on every change, so a fast typist produces one value", () => {
    const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "" },
    });

    for (const v of ["A", "Ac", "Acc", "Accr", "Accra"]) {
      rerender({ v });
      act(() => {
        jest.advanceTimersByTime(100);
      });
    }
    // 500ms of typing, but never 300ms of quiet.
    expect(result.current).toBe("");

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("Accra");
  });
});

describe("useAddressSearch", () => {
  it("issues no request below the minimum length", () => {
    // The backend's DTO rejects these with a 400, so asking spends a round
    // trip to be told off.
    setup("O");

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(mockSearchAddresses).not.toHaveBeenCalled();
    expect(MIN_QUERY_LENGTH).toBe(2);
  });

  it("issues no request for whitespace", () => {
    setup("   ");

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(mockSearchAddresses).not.toHaveBeenCalled();
  });

  it("searches once typing pauses", async () => {
    setup("Osu");

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    await waitFor(() => expect(mockSearchAddresses).toHaveBeenCalledWith({ q: "Osu" }));
  });

  it("trims what it sends", async () => {
    setup("  Osu  ");

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    await waitFor(() => expect(mockSearchAddresses).toHaveBeenCalledWith({ q: "Osu" }));
  });

  it("sends no country, leaving the backend to default it to the caller's", async () => {
    // Mapping GHA -> GH in the app would be that mapping's second home, for no
    // gain: the backend already defaults it, and an unfiltered search returns
    // places on three continents.
    setup("Osu");

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    await waitFor(() => expect(mockSearchAddresses).toHaveBeenCalled());
    expect(mockSearchAddresses.mock.calls[0]?.[0]).toEqual({ q: "Osu" });
  });

  it("caches by query text, so two different searches do not overwrite each other", async () => {
    const { result, rerender, queryClient } = setup("Osu");
    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.data).toEqual([OSU]));

    rerender({ text: "Tema" });
    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    await waitFor(() => expect(mockSearchAddresses).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryData(queryKeys.addressSearch("Osu"))).toEqual([OSU]);
  });

  it("keeps the previous results visible while the next query loads", async () => {
    const { result, rerender } = setup("Osu");
    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.data).toEqual([OSU]));

    mockSearchAddresses.mockReturnValue(new Promise(() => undefined));
    rerender({ text: "Tema" });
    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    // A list that empties and refills on every character is unreadable.
    expect(result.current.data).toEqual([OSU]);
  });
});
