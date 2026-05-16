import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the onboarding screen on first visit", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /what should other participants call you/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start browsing/i })).toBeInTheDocument();
  });
});
