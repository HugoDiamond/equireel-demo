/* FAQ en français — traduction de la FAQ anglaise (relecture humaine
   recommandée avant le lancement officiel FR). */

import { Header, Footer, Crumbs } from "../../../components/Chrome";
import { href } from "../../../lib/eq";

export const metadata = {
  title: "FAQ — Equireel (français)",
  description:
    "Tout savoir sur votre vidéo de cross Equireel — délais de livraison, montage, musique, confidentialité et remboursements.",
  alternates: { languages: { en: "/faq", fr: "/fr/faq" } }
};

export default function FaqFr() {
  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: "FAQ (FR)" }]} />
        <h1>Questions fréquentes</h1>
        <p className="sub">Vous ne trouvez pas votre réponse ? Écrivez à
          <a href="mailto:info@equireel.com"> info@equireel.com</a> — un humain vous répond, vite.</p>
      </div>

      <div className="container faq" style={{ paddingBottom: "56px", maxWidth: "820px" }}>
        <details>
          <summary>Comment retrouver ma vidéo ?</summary>
          <p>Cherchez votre cheval, votre nom ou votre numéro de dossard depuis la page d&rsquo;accueil, ou ouvrez
            votre concours et parcourez la liste des partants. Si nous étions à votre concours, chaque couple y
            figure — aucune réservation nécessaire.</p>
        </details>
        <details>
          <summary>À quoi ressemblent les vidéos ?</summary>
          <p>Regardez de vrais exemples avant de commander — une vidéo de cross, un réel vertical et une vidéo de
            saut d&rsquo;obstacles sont sur <a href={href("/#samples")}>notre page d&rsquo;accueil</a>.</p>
        </details>
        <details>
          <summary>Quand ma vidéo sera-t-elle prête ?</summary>
          <p>Cela dépend du concours — le délai exact est affiché <strong>sous le bouton de commande</strong> avant
            le paiement. Certaines vidéos sont disponibles immédiatement, d&rsquo;autres dans l&rsquo;heure, le reste
            sous 5 jours. Votre vidéo arrive par e-mail depuis info@equireel.com — pensez à vérifier vos spams.</p>
        </details>
        <details>
          <summary>Et si j&rsquo;ai déclaré forfait ou été éliminé&middot;e ?</summary>
          <p>Forfait avant le cross : remboursement intégral ou avoir, à votre choix. Élimination ou abandon sur le
            parcours : nous pouvons vous livrer toutes les images jusqu&rsquo;à la fin de votre journée, ou vous
            rembourser — à votre choix.</p>
        </details>
        <details>
          <summary>Ma vidéo est-elle publique ou privée ?</summary>
          <p>C&rsquo;est votre choix au moment de la commande. Les vidéos publiques peuvent apparaître sur nos
            réseaux sociaux ; décochez « Public video » et vous seul&middot;e recevrez le lien.</p>
        </details>
        <details>
          <summary>Puis-je demander des modifications ?</summary>
          <p>Oui — les demandes de retouche sont gratuites après livraison : répondez simplement à l&rsquo;e-mail de
            livraison.</p>
        </details>
        <details>
          <summary>Puis-je offrir une vidéo ?</summary>
          <p>Oui — <a href={href("/gift-vouchers")}>les bons cadeaux</a> existent à partir de 10 €, envoyés
            instantanément par e-mail avec votre message, valables 24 mois.</p>
        </details>
        <details>
          <summary>Faut-il réserver Equireel avant mon concours ?</summary>
          <p>Non. Si Equireel est présent à votre concours, chaque concurrent est filmé automatiquement, à chaque
            obstacle. Consultez <a href={href("/calendar")}>le calendrier</a> pour savoir où nous serons.</p>
        </details>
      </div>

      <Footer />
    </>
  );
}
