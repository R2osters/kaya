import type { Locale } from "@kaya/core";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { KayaI18nProvider, useLocale } from "./KayaI18nProvider";

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  return (
    <>
      <Text testID="locale-value">{locale}</Text>
      <Pressable testID="switch-to-en" onPress={() => setLocale("en")}>
        <Text>en</Text>
      </Pressable>
      <Pressable testID="switch-to-fr" onPress={() => setLocale("fr")}>
        <Text>fr</Text>
      </Pressable>
      {/* Cast bypasses the Locale union: real callers can hand this a raw
          string (e.g. a persisted preference), and that is exactly the input
          the fallback exists to handle. */}
      <Pressable testID="switch-to-unsupported" onPress={() => setLocale("es" as Locale)}>
        <Text>es</Text>
      </Pressable>
    </>
  );
}

describe("KayaI18nProvider", () => {
  it("renders its children", () => {
    render(
      <KayaI18nProvider>
        <Text testID="child">hello</Text>
      </KayaI18nProvider>,
    );

    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("defaults to French", () => {
    render(
      <KayaI18nProvider>
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    expect(screen.getByTestId("locale-value").props.children).toBe("fr");
  });

  it("exposes the current locale and switches it through useLocale", () => {
    render(
      <KayaI18nProvider>
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    fireEvent.press(screen.getByTestId("switch-to-en"));
    expect(screen.getByTestId("locale-value").props.children).toBe("en");

    fireEvent.press(screen.getByTestId("switch-to-fr"));
    expect(screen.getByTestId("locale-value").props.children).toBe("fr");
  });

  it("falls back to French for an unsupported initial locale", () => {
    render(
      <KayaI18nProvider locale={"es" as Locale}>
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    expect(screen.getByTestId("locale-value").props.children).toBe("fr");
  });

  it("falls back to French when setLocale is called with an unsupported locale", () => {
    render(
      <KayaI18nProvider>
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    fireEvent.press(screen.getByTestId("switch-to-en"));
    expect(screen.getByTestId("locale-value").props.children).toBe("en");

    fireEvent.press(screen.getByTestId("switch-to-unsupported"));
    expect(screen.getByTestId("locale-value").props.children).toBe("fr");
  });
});
