import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { EmptyState } from "./EmptyState";
import { colors } from "../theme";

describe("EmptyState", () => {
  it("renders the title and the icon", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Aucune commande" testID="empty" />);
    expect(screen.getByText("Aucune commande")).toBeTruthy();
    expect(screen.getByText("icon")).toBeTruthy();
  });

  it("renders an optional message", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Aucune commande" message="Revenez plus tard" />);
    expect(screen.getByText("Revenez plus tard")).toBeTruthy();
  });

  it("omits the message when none is given", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Aucune commande" />);
    expect(screen.queryByText("Revenez plus tard")).toBeNull();
  });

  it("renders the action and fires onAction when both actionLabel and onAction are given", () => {
    const onAction = jest.fn();
    render(
      <EmptyState icon={<Text>icon</Text>} title="Aucune commande" actionLabel="Réessayer" onAction={onAction} />,
    );
    fireEvent.press(screen.getByText("Réessayer"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render an action button when only actionLabel is given", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Aucune commande" actionLabel="Réessayer" />);
    expect(screen.queryByText("Réessayer")).toBeNull();
  });

  it("does not render an action button when only onAction is given", () => {
    render(<EmptyState icon={<Text>icon</Text>} title="Aucune commande" onAction={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("hands the tertiary ink colour to a function icon", () => {
    const seen: string[] = [];
    const icon = (color: string) => {
      seen.push(color);
      return <Text>ico</Text>;
    };
    render(<EmptyState icon={icon} title="Aucune commande" />);
    expect(seen).toEqual([colors.inkTertiary]);
  });
});
