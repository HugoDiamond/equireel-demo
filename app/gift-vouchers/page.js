/* Gift vouchers — the giftable product: any amount, either currency,
   emailed to you or straight to the recipient with a message. */

import { Header, Footer, Crumbs } from "../../components/Chrome";
import BuyVoucher from "./buy";

export const metadata = {
  title: "Gift Vouchers — Equireel",
  description:
    "Give an Equireel gift voucher — they choose their own cross country video, filmed at every fence. Any amount from £10, emailed instantly with your message, valid 24 months."
};

export default function GiftVoucherPage() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "Gift vouchers" }]} />
        <h1>Give the ride, not another headcollar</h1>
        <p className="sub">An Equireel gift voucher buys their own round, professionally filmed at every fence —
          the present every rider actually wants. Emailed instantly, with your message on it.</p>
      </div>

      <div className="container" style={{ paddingBottom: "56px", maxWidth: "620px" }}>
        <BuyVoucher />
      </div>

      <Footer />
    </>
  );
}
