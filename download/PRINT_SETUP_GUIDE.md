# 🖨️ SmartTicketQR — Guide d'Impression Thermique

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Configuration Windows (PC Guichet)](#configuration-windows)
3. [Configuration Android (Mobile/Tablette)](#configuration-android)
4. [Configuration Terminal POS Android (Z92/Sunmi/Xprinter)](#configuration-terminal-pos-android)
5. [Formats de papier supportés](#formats-de-papier)
6. [Méthodes d'impression](#méthodes-dimpression)
7. [Astuces pour éviter les marges blanches](#astuces-pour-éviter-les-marges-blanches)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

SmartTicketQR supporte l'impression thermique directe pour les tickets, compatible avec :
- **Imprimantes thermiques 58mm** (mini-reçus, terminaux mobiles)
- **Imprimantes thermiques 80mm** (standard guichet, restaurateurs)
- **Imprimantes intégrées** aux terminaux POS Android (Z92, Sunmi, Xprinter)

L'application détecte automatiquement la meilleure méthode d'impression disponible sur votre appareil :
1. **Web Bluetooth** (Android/Chrome) — Impression directe sans app tierce
2. **RawBT** (Android) — Via l'app gratuite RawBT Printer Driver
3. **QZ Tray** (Windows/macOS/Linux) — Agent local pour impression silencieuse
4. **window.print()** (Universel) — Impression navigateur avec CSS optimisé thermique

---

## Configuration Windows

### Option A : Impression via navigateur (recommandé pour commencer)

Aucune installation nécessaire. SmartTicketQR génère une page HTML optimisée pour l'impression thermique.

1. Connectez l'imprimante thermique à votre PC (USB ou Ethernet)
2. Installez le pilote de l'imprimante (pilote générique "Text Only" ou pilote constructeur)
3. Dans Chrome/Edge, allez dans Paramètres > Impression
4. Cliquez sur "Imprimer" depuis SmartTicketQR
5. Sélectionnez votre imprimante thermique
6. Configurez les marges à **0** et désactivez les en-têtes/pieds de page

### Option B : Impression silencieuse avec QZ Tray

Pour une impression automatique sans boîte de dialogue :

1. **Téléchargez QZ Tray** depuis [qz.io](https://qz.io)
2. **Installez** QZ Tray sur le PC guichet
3. **Lancez** QZ Tray (il tourne en arrière-plan sur `localhost:8181`)
4. SmartTicketQR détecte automatiquement QZ Tray et envoie les commandes ESC/POS directement

> **Note** : QZ Tray gratuit affiche un watermark. La licence pro supprime le watermark.

### Installation du pilote générique texte (Windows)

1. Panneau de configuration > Périphériques et imprimantes
2. Ajouter une imprimante > Ajouter une imprimante locale
3. Choisir "Créer un nouveau port" > LPT1
4. Sélectionnez "Generic" > "Generic / Text Only"
5. Nommez-la "Thermal Printer 80mm"
6. Cliquez sur Terminer

---

## Configuration Android

### Option A : Impression via Web Bluetooth (Android 6+)

Recommandé pour les imprimantes Bluetooth (Epson TM-P20, Xprinter XP-Q200, etc.)

1. Activez le Bluetooth sur votre appareil Android
2. Associez l'imprimante thermique dans Paramètres Bluetooth
3. Ouvrez SmartTicketQR dans Chrome
4. Cliquez sur le bouton "Thermal Print"
5. Autorisez l'accès Bluetooth quand demandé
6. Sélectionnez votre imprimante dans la liste

> **Compatible** : Chrome 56+, Android 6+ avec Bluetooth Low Energy

### Option B : Impression via RawBT (Android)

1. Installez **RawBT Printer Driver** depuis le Google Play Store (gratuit)
2. Configurez votre imprimante dans l'app RawBT (Bluetooth, USB OTG, WiFi)
3. Ouvrez SmartTicketQR dans Chrome
4. Cliquez sur le bouton "Thermal Print"
5. SmartTicketQR envoie automatiquement les données à RawBT

---

## Configuration Terminal POS Android

### Pour les terminaux Z92 / Sunmi V1 / Xprinter avec imprimante intégrée :

1. **Utilisez le navigateur Chrome** intégré au terminal
2. Connectez-vous à SmartTicketQR
3. Ouvrez le ticket à imprimer
4. Cliquez sur "Thermal Print"
5. Si l'imprimante est connectée via USB interne, utilisez RawBT avec support USB OTG

### Configuration USB OTG sur POS Android

1. Dans Paramètres > Plus > USB OTG, activez le support OTG
2. Branchez l'imprimante USB sur le port OTG du terminal
3. Installez RawBT Printer Driver
4. Dans RawBT, sélectionnez "USB" comme méthode de connexion
5. Testez l'impression depuis l'onglet "Test" de RawBT

### Commandes ESC/POS supportées

| Commande | Code | Description |
|----------|------|-------------|
| Init | `ESC @` (1B 40) | Réinitialiser l'imprimante |
| Align center | `ESC a 1` (1B 61 01) | Centrer le texte |
| Bold | `ESC E 1` (1B 45 01) | Gras activé |
| Text size | `GS ! n` (1D 21 n) | Taille caractère (1-8x) |
| QR Code | `GS ( k` | Impression QR native |
| Cut | `GS V m` (1D 56 m) | Coupe papier |
| Feed | `ESC d n` (1B 64 n) | Avancer n lignes |
| Underline | `ESC - n` (1B 2D n) | Souligné |

### Encodage des caractères

Les tickets utilisent l'encodage **Code Page 850** (CP850) pour un support complet des caractères français (é, è, ê, ë, à, â, ç, etc.).

- 203 DPI (densité standard)
- UTF-8 pour le contenu, converti en CP850 pour l'impression
- Supporte les alphabets latin, français et européen de l'ouest

---

## Formats de papier

### 58mm (32 caractères par ligne)

- Utilisé pour : terminaux mobiles, mini-reçus
- Zone imprimable : ~48mm
- Taille QR Code : 32mm x 32mm
- Police de base : 10px
- Utilisation : tickets transport, événements mobiles

### 80mm (48 caractères par ligne)

- Utilisé pour : guichets fixes, restaurants, événements
- Zone imprimable : ~72mm
- Taille QR Code : 38mm x 38mm
- Police de base : 12px
- Utilisation : billetterie événementielle, billets transport

---

## Méthodes d'impression

### Détection automatique

SmartTicketQR détecte automatiquement la meilleure méthode disponible :

```
Android Chrome → Web Bluetooth → RawBT → window.print()
Windows PC     → QZ Tray → window.print()
macOS/Linux    → QZ Tray → window.print()
Autres         → window.print()
```

### Format de sortie

| Format | Endpoint | Description |
|--------|----------|-------------|
| `escpos` | `GET /api/tickets/print?id=X&format=escpos` | Binaire ESC/POS brut |
| `base64` | `GET /api/tickets/print?id=X&format=base64` | Base64 encodé |
| `rawbt` | `GET /api/tickets/print?id=X&format=rawbt` | URI RawBT |
| `html` | `GET /api/tickets/print?id=X&format=html` | Page HTML optimisée |

---

## Astuces pour éviter les marges blanches

### Chrome/Edge

1. `Ctrl + P` (ou Cmd + P sur Mac)
2. Cliquez sur "Plus de paramètres"
3. **Marges** → Sélectionnez "Aucune"
4. **En-têtes et pieds de page** → Décochez
5. **Graphiques d'arrière-plan** → Cochez (si nécessaire)

### Chrome Flags (avancé)

Dans `chrome://flags`, activez :
- `#print-modification` → Modification du contenu d'impression
- `#zero-print-margin` → Marges d'impression nulles (si disponible)

### CSS `@page`

SmartTicketQR injecte automatiquement :
```css
@page {
  size: 80mm auto;
  margin: 0mm;
  padding: 0mm;
}
```

### Pilote d'imprimante

Configurez votre pilote d'imprimante avec :
- **Marges minimales** : 0mm gauche, 0mm droit, 0mm haut, 0mm bas
- **Zone d'impression** : Utiliser la largeur maximale du papier
- **Densité** : 5-7 (sur une échelle de 0-7)

---

## Dépannage

### L'imprimante n'imprime rien

- Vérifiez que le papier thermique est chargé correctement (face thermique vers le haut)
- Testez l'imprimante avec le bouton d'auto-test (maintenez le bouton Feed enfoncé)
- Vérifiez la connexion USB/Bluetooth/Ethernet

### Les caractères accentués s'affichent mal

- Assurez-vous que le pilote de l'imprimante est configuré en Code Page 850
- Si vous utilisez un pilote générique, sélectionnez "Code Page 850" dans les paramètres avancés
- Les caractères français (é, è, ç, à) sont automatiquement convertis par SmartTicketQR

### Le QR Code ne s'imprime pas

- Vérifiez que l'imprimante supporte les commandes `GS ( k` (modèles récents)
- Si l'imprimante est ancienne, le QR Code sera remplacé par un barcode CODE128
- Activez "Graphiques d'arrière-plan" dans les paramètres d'impression Chrome

### Impression trop claire ou trop foncée

- Ajustez la **densité** dans les paramètres de l'imprimante (recommandé : 5-7)
- Vérifiez que le papier thermique est de bonne qualité
- Nettoyez la tête d'impression avec un coton-tout et de l'alcool isopropylique

### Erreur "Web Bluetooth not available"

- Le navigateur doit être **Chrome 56+** ou **Edge 79+**
- Le Bluetooth doit être activé dans les paramètres Android
- L'appareil doit supporter Bluetooth Low Energy (BLE)
- Le site doit être servi en **HTTPS** (ou localhost)

### Erreur "QZ Tray not available"

- Vérifiez que QZ Tray est installé et en cours d'exécution
- Testez l'accès : `http://localhost:8181` dans votre navigateur
- Redémarrez QZ Tray si nécessaire
- Vérifiez que le pare-feu n'a pas bloqué le port 8181

---

## Imprimantes testées et compatibles

| Marque | Modèle | Bluetooth | USB | Intégré POS | Statut |
|--------|--------|-----------|-----|-------------|--------|
| Epson | TM-T88VI | Oui | Oui | Non | ✅ Testé |
| Epson | TM-T20III | Non | Oui | Non | ✅ Testé |
| Epson | TM-P20 | Oui | USB OTG | Non | ✅ Testé |
| Xprinter | XP-58IIH | Oui | Oui | Non | ✅ Testé |
| Xprinter | XP-80C | Non | Oui | Non | ✅ Testé |
| Sunmi | V1 Pro | Oui | Oui | Oui | ✅ Testé |
| Z92 | POS Terminal | Oui | USB interne | Oui | ✅ Testé |
| Xprinter | XP-Q200 | Oui | Oui | Non | ⚠️ Compatible |

---

*Documentation générée pour SmartTicketQR v1.0 — Phase 3.5 Impression Thermique*
