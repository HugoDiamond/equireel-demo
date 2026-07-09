import { Header, Footer } from "../../../components/Chrome";
import OrdersQueue from "./queue";

export const metadata = {
  title: "Order Queue — Equireel",
  robots: { index: false, follow: false }
};

export default function AdminOrdersPage() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ minHeight: "60vh" }}>
        <OrdersQueue />
      </main>
      <Footer />
    </>
  );
}
