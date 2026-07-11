import { Header, Footer } from "../../../components/Chrome";
import CalendarTool from "./tool";

export const metadata = {
  title: "Filming Calendar Admin — Equireel",
  robots: { index: false, follow: false }
};

export default function AdminCalendarPage() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ minHeight: "60vh" }}>
        <CalendarTool />
      </main>
      <Footer />
    </>
  );
}
