/* Work with us — quiet data-capture page for future camera-technician roles.
   Linked from the footer only (David: not important right now, keep small). */

import { Header, Footer, Crumbs } from "../../components/Chrome";
import CareersForm from "./form";

export const metadata = {
  title: "Work With Us — Equireel",
  description:
    "Register your interest in freelance on-course camera technician roles with Equireel across the UK, Ireland and the USA. No camera experience required — full training, van and kit provided."
};

export default function CareersPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "Work with us" }]} />
        <h1>Work with us</h1>
        <p className="sub">We hire freelance on-course camera technicians for eventing weekends across the UK,
          Ireland and the USA — no camera experience needed, full training and all kit provided.
          We&rsquo;re not always hiring, but we&rsquo;re always looking: leave your details and we&rsquo;ll
          contact you when a role opens near you.</p>
      </div>

      <div className="container" style={{ paddingBottom: "56px", maxWidth: "720px" }}>
        <ul className="cr-points">
          <li>Freelance, event-by-event (mostly Thursday–Sunday)</li>
          <li>Van, quad, cameras, fuel card and hotels all provided</li>
          <li>Paid per event, experience-dependent</li>
          <li>Physical outdoor days on a 5km course — self-starters thrive</li>
        </ul>
        <CareersForm />
      </div>

      <Footer />
    </>
  );
}
