import React from "react";
import { renderToString } from "react-dom/server";
import { LandingPage } from "./LandingPage.jsx";

export function renderLandingPage(year) {
  return renderToString(<LandingPage year={year} />);
}
