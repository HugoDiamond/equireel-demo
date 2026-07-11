/* My videos — the passwordless account: every video this email has ever
   ordered (legacy shop history included), delivered links + in-edit status. */

import { Header, Footer, Crumbs } from "../../components/Chrome";
import MyVideos from "./lib";

export const metadata = {
  title: "My Videos — Equireel",
  description: "Every Equireel video you've ordered, in one place. Sign in with just your email — no password needed.",
  robots: { index: false }
};

export default function MyVideosPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "My videos" }]} />
        <h1>My videos</h1>
        <p className="sub">Every video you&rsquo;ve ordered, in one place — including past seasons.
          Sign in with just your email.</p>
      </div>

      <div className="container" style={{ paddingBottom: "56px", maxWidth: "820px" }}>
        <MyVideos />
      </div>

      <Footer />
    </>
  );
}
