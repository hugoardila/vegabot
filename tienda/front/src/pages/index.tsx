import React from "react";
import { MainLayout } from "../components/templates/MainLayout";
import { ProductsPage } from "./products";

const IndexPage: React.FC = () => (
  <MainLayout>
    <ProductsPage />
  </MainLayout>
);

export default IndexPage;
