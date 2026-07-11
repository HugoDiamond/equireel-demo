/* Where we'll be — public filming calendar. Reads the filming_calendar
   table live via /api/calendar; self-maintaining, never edited on the site. */

import { Header, Footer, Crumbs } from "../../components/Chrome";
import Calendar from "./cal";

export const metadata = {
  title: "Filming Calendar — Where Equireel Will Be | Equireel",
  description:
    "Every event Equireel is filming this season, across the UK, Ireland, France, Belgium and the USA. If we're at your event, every rider at every fence is filmed — no booking needed."
};

export default function CalendarPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "Filming calendar" }]} />
        <h1>Where we&rsquo;ll be</h1>
        <p className="sub">If Equireel is at your event, you&rsquo;re already being filmed — every rider, every fence,
          no booking needed. Videos go on sale here after the event.</p>
      </div>

      <div className="container" style={{ paddingBottom: "56px", maxWidth: "860px" }}>
        <Calendar />
      </div>

      <Footer />
    </>
  );
}
