/* Accueil français — v1: page d'entrée entièrement en français, reliée au
   catalogue (les pages de commande restent en anglais pour l'instant —
   phase 2 après relecture humaine). hreflang appairé avec la page anglaise. */

import { Header, Footer } from "../../components/Chrome";
import { href } from "../../lib/eq";

export const metadata = {
  title: "Equireel — Votre cross filmé, obstacle par obstacle",
  description:
    "Vidéos professionnelles de concours complet. Retrouvez votre épreuve, regardez un exemple et commandez votre parcours de cross — filmé à chaque obstacle, monté et livré par e-mail.",
  alternates: { languages: { en: "/", fr: "/fr" } }
};

export default function AccueilFr() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <h1>Chaque cavalier. Chaque obstacle. Filmé.</h1>
        <p className="sub">Equireel filme le cross des concours complets en France, au Royaume-Uni, en Irlande,
          en Belgique et aux États-Unis — <strong>chaque concurrent, à chaque obstacle, sans réservation</strong>.
          Si nous étions à votre concours, votre parcours existe déjà.</p>
      </div>

      <div className="container" style={{ paddingBottom: "56px", maxWidth: "860px" }}>
        <section className="fr-block">
          <h2>Comment ça marche</h2>
          <ol className="fr-steps">
            <li><strong>Trouvez votre vidéo</strong> — cherchez votre cheval, votre nom ou votre numéro de dossard,
              ou parcourez <a href={href("/events?country=fr")}>les concours français</a>.</li>
            <li><strong>Commandez en une minute</strong> — paiement sécurisé par carte, Apple Pay ou Google Pay
              (Stripe). Aucun compte nécessaire.</li>
            <li><strong>Recevez votre parcours</strong> — filmé et monté par des professionnels, livré par e-mail
              sous 5 jours (souvent bien plus vite), à garder et à partager.</li>
          </ol>
        </section>

        <section className="fr-block">
          <h2>Nos produits</h2>
          <ul className="fr-list">
            <li><strong>Vidéo de cross — 70 €</strong> : votre parcours complet, chaque obstacle, musique et
              drapeau de votre choix.</li>
            <li><strong>Réel pour les réseaux — +10 €</strong> : montage vertical prêt pour Instagram et TikTok.</li>
            <li><strong>Vidéo de saut d&rsquo;obstacles — +20 € (ou 30 € seule)</strong>.</li>
          </ul>
          <p>Chaque vidéo est réalisée à la commande : drapeau, musique, sons du parcours, fautes incluses ou non,
            publique ou privée — c&rsquo;est vous qui choisissez.</p>
        </section>

        <section className="fr-block">
          <h2>Où nous serons</h2>
          <p>Consultez <a href={href("/calendar")}>notre calendrier de tournage</a> — dont le Royal Jump de
            Bertichères, Pompadour, Le Lion d&rsquo;Angers et l&rsquo;Open de France. Votre concours n&rsquo;y
            figure pas encore ? Écrivez-nous : <a href="mailto:info@equireel.com">info@equireel.com</a>.</p>
        </section>

        <section className="fr-block">
          <h2>Questions fréquentes</h2>
          <p><a href={href("/fr/faq")}>Toutes les réponses en français →</a></p>
        </section>

        <div className="fr-cta">
          <a className="btn primary big" href={href("/events?country=fr")}>Trouver mon concours</a>
          <p className="fr-note">Les pages de commande sont pour l&rsquo;instant en anglais — le paiement
            reste simple : cheval, options, e-mail, carte.</p>
        </div>
      </div>

      <Footer />
    </>
  );
}
