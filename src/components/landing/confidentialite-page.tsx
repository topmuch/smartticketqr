'use client';

import React from 'react';

const sections = [
  {
    title: '1. Collecte des donnees',
    content: [
      { heading: 'Donnees que nous collectons', text: 'Nous collectons les donnees suivantes lors de votre utilisation de SmartTicketQR : nom complet, adresse email, numero de telephone, nom de votre organisation, type d\'activite, donnees de facturation, ainsi que les donnees techniques (adresse IP, type de navigateur, systeme d\'exploitation).' },
      { heading: 'Donnees de vos clients', text: 'Lorsque vous utilisez notre plateforme pour vendre des billets, les donnees de vos acheteurs (nom, email, telephone) sont collectees et stockees de maniere securisee. Vous restez le proprietaire de ces donnees.' },
      { heading: 'Finalite de la collecte', text: 'Ces donnees sont collectees pour : la creation et gestion de votre compte, la fourniture de nos services de billetterie, l\'envoi de billets a vos clients, la facturation et le support client, l\'amelioration continue de nos services.' },
    ],
  },
  {
    title: '2. Utilisation des donnees',
    content: [
      { heading: 'Utilisation principale', text: 'Vos donnees sont utilisees pour fournir et ameliorer nos services : gestion des billets, validation QR code, generation de statistiques, envoi de notifications, support technique.' },
      { heading: 'Communications', text: 'Nous pouvons vous envoyer des communications liees a votre compte (factures, alertes de securite) et, avec votre consentement, des informations sur nos nouvelles fonctionnalites et offres speciales. Vous pouvez vous desinscrire a tout moment.' },
      { heading: 'Amelioration des services', text: 'Nous utilisons des donnees anonymisees pour analyser l\'utilisation de la plateforme, identifier les axes d\'amelioration et detecter les comportements frauduleux.' },
    ],
  },
  {
    title: '3. Partage des donnees',
    content: [
      { heading: 'Prestataires de services', text: 'Nous partageons certaines donnees avec des prestataires de confiance (hebergement, paiement, SMS) dans le strict cadre de la fourniture de nos services. Tous nos prestataires sont soumis a des accords de confidentialite stricts.' },
      { heading: 'Partenaires de paiement', text: 'Les donnees de paiement sont transmises directement a nos partenaires bancaires et de paiement mobile (Wave, Orange Money) conformement aux reglementations en vigueur. Nous ne stockons aucune donnee de carte bancaire.' },
      { heading: 'Obligations legales', text: 'Nous pouvons etre amenes a communiquer vos donnees en reponse a une demande legale d\'une autorite competente, dans le respect de la legislation applicable.' },
    ],
  },
  {
    title: '4. Securite des donnees',
    content: [
      { heading: 'Mesures techniques', text: 'Nous mettons en oeuvre des mesures de securite de pointe : chiffrement TLS 1.3 pour toutes les communications, stockage chiffre en base de donnees, authentification a double facteur, controle d\'acces strict, audits de securite reguliers.' },
      { heading: 'Signature HMAC-SHA256', text: 'Chaque QR code est signe numeriquement avec une signature HMAC-SHA256, garantissant l\'authenticite et l\'integrite de chaque billet.' },
      { heading: 'Notification d\'incident', text: 'En cas de violation de donnees, nous vous notifierons dans les 72 heures conformement aux reglementations en vigueur.' },
    ],
  },
  {
    title: '5. Droits des utilisateurs',
    content: [
      { heading: 'Droit d\'acces', text: 'Vous avez le droit d\'obtenir une copie de toutes les donnees personnelles que nous detenons sur vous. Vous pouvez en faire la demande via votre espace client ou par email a dpo@smartticketqr.com.' },
      { heading: 'Droit de rectification', text: 'Vous pouvez corriger ou mettre a jour vos donnees personnelles a tout moment depuis votre espace client ou en contactant notre support.' },
      { heading: 'Droit de suppression', text: 'Vous pouvez demander la suppression de vos donnees personnelles. Notez que certaines donnees peuvent etre conservees pour des obligations legales (facturation, lutte contre la fraude).' },
      { heading: 'Droit de portabilite', text: 'Vous pouvez demander a recevoir vos donnees dans un format structure et couramment utilise (JSON, CSV) pour les transferer a un autre service.' },
    ],
  },
  {
    title: '6. Cookies et traceurs',
    content: [
      { heading: 'Types de cookies', text: 'Nous utilisons des cookies essentiels au fonctionnement de la plateforme (authentification, preferences). Des cookies analytiques (anonymises) nous permettent de comprendre comment la plateforme est utilisee.' },
      { heading: 'Gestion des cookies', text: 'Vous pouvez configurer votre navigateur pour refuser les cookies. Notez que certaines fonctionnalites pourraient ne pas fonctionner correctement sans cookies.' },
    ],
  },
  {
    title: '7. Contact DPO',
    content: [
      { heading: 'Delegue a la Protection des Donnees', text: 'Pour toute question relative a la protection de vos donnees personnelles, vous pouvez contacter notre DPO :' },
      { heading: '', text: 'Email : dpo@smartticketqr.com\nAdresse : SmartTicketQR, Dakar, Senegal\nTel : +221 33 800 00 00' },
    ],
  },
];

export default function ConfidentialitePage() {
  return (
    <div className="pt-20 md:pt-24">
      {/* Header */}
      <section className="py-12 md:py-16 bg-gradient-to-br from-[#007BFF] to-[#0056b3] text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4">
            Politique de Confidentialite
          </h1>
          <p className="text-blue-100">
            Derniere mise a jour : 1er Janvier 2025
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 leading-relaxed mb-10">
              Chez SmartTicketQR, la protection de vos donnees personnelles est une priorite absolue.
              Cette politique de confidentialite decrit comment nous collectons, utilisons, partageons et protegeons vos donnees
              conformement aux reglementations locales et au RGPD.
            </p>

            <div className="space-y-10">
              {sections.map((section, i) => (
                <div key={i}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                    {section.title}
                  </h2>
                  <div className="space-y-4">
                    {section.content.map((item, j) => (
                      <div key={j}>
                        {item.heading && (
                          <h3 className="font-semibold text-gray-800 mb-1">{item.heading}</h3>
                        )}
                        <p className="text-gray-600 leading-relaxed whitespace-pre-line">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Box */}
            <div className="mt-12 bg-[#007BFF]/5 rounded-2xl p-6 border border-[#007BFF]/10">
              <h3 className="font-bold text-gray-900 mb-2">En resume</h3>
              <ul className="text-gray-600 space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#007BFF] mt-1">&#8226;</span>
                  Nous ne vendons jamais vos donnees a des tiers
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#007BFF] mt-1">&#8226;</span>
                  Vos donnees sont chiffrees et securisees
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#007BFF] mt-1">&#8226;</span>
                  Vous gardez le controle total de vos informations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#007BFF] mt-1">&#8226;</span>
                  Vous pouvez exercer vos droits a tout moment
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
