import { Header, Footer } from "../../../components/Chrome";
import IngestTool from "./tool";

export const metadata = {
  title: "Entries Ingest — Equireel",
  robots: { index: false, follow: false }
};

export default function AdminIngestPage() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ minHeight: "60vh" }}>
        <IngestTool />
      </main>
      <Footer />
    </>
  );
}
