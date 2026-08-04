import { createI18n, type Locale } from "@kaya/core";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { KayaI18nProvider, useLocale } from "./KayaI18nProvider";

// createI18n is wrapped in jest.fn() (delegating to the real implementation
// by default) so the one test below that needs a changeLanguage() rejection
// can substitute a controllable fake instance for a single call, without
// touching how every other test resolves locales.
jest.mock("@kaya/core", () => {
  const actual = jest.requireActual("@kaya/core");
  return { ...actual, createI18n: jest.fn(actual.createI18n) };
});
const mockedCreateI18n = createI18n as jest.MockedFunction<typeof createI18n>;

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

  it("follows a changed locale prop after mount, without needing setLocale or a remount", () => {
    // Phase 1C's failure scenario: the app reads a saved language from
    // SecureStore asynchronously, then re-renders with the resolved locale.
    // useState's initializer only runs once, so without a controlled sync
    // the UI would stay on the mount-time locale until a full remount.
    const { rerender } = render(
      <KayaI18nProvider locale="fr">
        <LocaleProbe />
      </KayaI18nProvider>,
    );
    expect(screen.getByTestId("locale-value").props.children).toBe("fr");

    rerender(
      <KayaI18nProvider locale="en">
        <LocaleProbe />
      </KayaI18nProvider>,
    );
    expect(screen.getByTestId("locale-value").props.children).toBe("en");
  });

  it("does not re-sync when the locale prop is re-rendered with the same value", () => {
    // A locally-driven switch (setLocale) must survive an incidental parent
    // re-render that keeps passing the same, unchanged `locale` prop --
    // otherwise every render would fight a local switch back to the prop.
    const { rerender } = render(
      <KayaI18nProvider locale="fr">
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    fireEvent.press(screen.getByTestId("switch-to-en"));
    expect(screen.getByTestId("locale-value").props.children).toBe("en");

    rerender(
      <KayaI18nProvider locale="fr">
        <LocaleProbe />
      </KayaI18nProvider>,
    );
    expect(screen.getByTestId("locale-value").props.children).toBe("en");
  });

  it("reports a failed language change instead of leaving it an unhandled rejection", async () => {
    // Same convention as LocationAdapter.watch's onError: a rejected
    // changeLanguage() (e.g. a language-loading backend failure) must not
    // become a silent no-op or a bare unhandled-rejection warning.
    const error = new Error("changeLanguage failed");
    // I18nextProvider only stores this in context (see its source) and
    // nothing in this tree calls useTranslation, so a changeLanguage-only
    // stub is all a real i18n instance needs to fake here.
    mockedCreateI18n.mockReturnValueOnce({
      changeLanguage: jest.fn().mockRejectedValueOnce(error),
    } as unknown as ReturnType<typeof createI18n>);

    const onLocaleChangeError = jest.fn();
    render(
      <KayaI18nProvider onLocaleChangeError={onLocaleChangeError}>
        <LocaleProbe />
      </KayaI18nProvider>,
    );

    fireEvent.press(screen.getByTestId("switch-to-en"));
    // Flushes the rejected promise's microtask so the .catch() handler runs
    // before the assertion below.
    await Promise.resolve().then().then();

    expect(onLocaleChangeError).toHaveBeenCalledWith(error);
  });
});
