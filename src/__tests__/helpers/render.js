import React from "react";
import { render } from "@testing-library/react";

export function renderPage(Component) {
  return render(React.createElement(Component));
}
