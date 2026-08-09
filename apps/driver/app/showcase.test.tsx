import { KayaI18nProvider } from "@kaya/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ShowcaseScreen from "./showcase";

/**
 * Renders every @kaya/ui component once and asserts each is present. This is
 * the automated half of task 5's visual acceptance surface -- it proves the
 * showcase mounts, wires every component's required props, and (see the two
 * tests at the bottom) that the RatingStars testID fix actually holds when
 * two rows share a screen. It cannot judge shadow weight, line-height, or
 * whether the half-star glyph has a visible seam -- those need a human
 * looking at a device or the reference screenshots, per the brief.
 */
function renderShowcase() {
  return render(
    <KayaI18nProvider>
      <ShowcaseScreen />
    </KayaI18nProvider>,
  );
}

describe("design-system showcase", () => {
  it("renders one instance of every @kaya/ui component", () => {
    renderShowcase();

    const testIDs = [
      "showcase-button-primary",
      "showcase-button-secondary",
      "showcase-button-danger",
      "showcase-button-loading",
      "showcase-card",
      "showcase-pill-success",
      "showcase-pill-primary",
      "showcase-pill-danger",
      "showcase-pill-amber",
      "showcase-pill-neutral",
      "showcase-rating-one",
      "showcase-rating-two",
      "showcase-avatar-initials",
      "showcase-avatar-ring",
      "showcase-textfield",
      "showcase-empty-state",
      "showcase-sheet-trigger",
      "showcase-skeleton",
      "showcase-map",
    ];

    for (const testID of testIDs) {
      expect(screen.getByTestId(testID)).toBeTruthy();
    }

    // KayaSkeletonListTile, KayaSkeletonList and KayaSkeletonCard each carry
    // importantForAccessibility="no-hide-descendants" on their own root, so a
    // screen reader groups the whole placeholder into one announcement.
    // React Native Testing Library treats that prop as "hidden from
    // accessibility" and excludes the node from queries by default -- same
    // quirk already documented in @kaya/ui's own tests for these three
    // components (see e.g. KayaSkeletonListTile.test.tsx), opted back into
    // here rather than worked around.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId("showcase-skeleton-list-tile", hidden)).toBeTruthy();
    expect(screen.getByTestId("showcase-skeleton-list", hidden)).toBeTruthy();
    expect(screen.getByTestId("showcase-skeleton-card", hidden)).toBeTruthy();
  });

  it("opens BottomSheetShell (mounted only while visible) from its trigger button", () => {
    renderShowcase();

    expect(screen.queryByTestId("showcase-sheet")).toBeNull();
    fireEvent.press(screen.getByTestId("showcase-sheet-trigger"));
    expect(screen.getByTestId("showcase-sheet")).toBeTruthy();
  });

  // Verification item 3 from task 5's brief, directly: two RatingStars on
  // one screen used to both produce "star-0".."star-4", making
  // getByTestId ambiguous between them. @kaya/ui's fix scopes each star to
  // its row's own testID -- these assertions are what would have failed
  // before that fix landed.
  it("does not collide the two RatingStars rows' star testIDs", () => {
    renderShowcase();

    expect(screen.getByTestId("showcase-rating-one-star-0")).toBeTruthy();
    expect(screen.getByTestId("showcase-rating-two-star-0")).toBeTruthy();
    // The old unscoped form must not exist at all now that both rows pass a
    // testID -- if it did, it would be genuinely ambiguous which row it
    // belonged to.
    expect(screen.queryByTestId("star-0")).toBeNull();
  });

  it("shows the half-star glyph (outline layered under half-fill) on the last star of the first row", () => {
    // value={4.3} on a 5-star row: kindAt(4, 4.3) is the half branch (4 < 4.3
    // and 4.3 - 4 = 0.3 >= 0.25). This only proves the *kind* computed is
    // "half" -- whether the two layered glyphs actually line up without a
    // visible seam is exactly the thing a human has to look at (brief,
    // verification item 2).
    renderShowcase();

    const lastStar = screen.getByTestId("showcase-rating-one-star-4");
    expect(lastStar.props.accessibilityLabel).toBe("half");
  });

  it("matches the captured render tree, for a human to diff against the reference screenshots", () => {
    const { toJSON } = renderShowcase();
    expect(toJSON()).toMatchSnapshot();
  });
});
