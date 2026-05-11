import React from "react";
import { Route, Routes } from "react-router-dom";
import DocumentationLayout from "./DocumentationLayout.jsx";
import DocumentationHome from "./DocumentationHome.jsx";
import UseCaseArticlePage from "./UseCaseArticlePage.jsx";

export default function DocumentationRoutes() {
  return (
    <Routes>
      <Route element={<DocumentationLayout />}>
        <Route index element={<DocumentationHome />} />
        <Route path="usecases/:slug" element={<UseCaseArticlePage />} />
      </Route>
    </Routes>
  );
}
