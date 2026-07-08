const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../debug.log');
function logDebug(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('⚠️  GEMINI_API_KEY manquante dans le fichier .env !');
}
const ai = new GoogleGenAI({ apiKey }); 

function getSystemPrompt(categoriesList = [], userProfileContext = '') {
  const categoriesStr = categoriesList.length > 0 
    ? categoriesList.map(c => c.name).join(' / ') 
    : 'Travail / Formation / Temps Personnel / Développement / Autre';

  const contextStr = userProfileContext 
    ? `\n=== PROFIL ET CONTEXTE DE L'UTILISATEUR ===\n${userProfileContext}\nPrends en compte ce profil de vie pour interpréter intelligemment les types d'événements et les classer de manière sémantique.\n` 
    : '';

  return `
Tu es un moteur d'extraction de planning ULTRA-RIGOUREUX. Ta precision sur les dates et les heures est CRITIQUE.
Tu peux analyser du texte ou des images (captures d'ecran d'autres applications de calendrier, de notes, d'emails ou de plannings).
${contextStr}
=== REGLES DE RIGUEUR ABSOLUES ===

1. DATES :
   - Tu DOIS extraire la date sous le format YYYY-MM-DD.
   - Si un jour de la semaine (ex: "vendredi", "dimanche") et une date numérique (ex: "13/06/2026") ne correspondent pas, fais TOUJOURS confiance à la DATE NUMÉRIQUE (ex: 13/06/2026 devient 2026-06-13). La date numérique est la priorité absolue.
   - N'invente JAMAIS une date. Si tu ne peux pas determiner la date exacte, IGNORE l'evenement.

2. HEURES :
   - Extrais UNIQUEMENT les heures EXPLICITEMENT presentes dans le texte ou l'image.
   - N'invente JAMAIS une heure. Si l'heure de fin n'est pas visible, estime-la avec duree_minutes (60 ou 90 ou 120 selon le contexte).
   - Format strict : "HH:MM" (ex: "08:30", "14:00").

3. ANTI-DUPLICATION :
   - Un cours/rendez-vous = UN SEUL evenement. Ne cree jamais 2 evenements pour le meme cours au meme creneau.
   - Si un cours dure 2h (ex: 08:30 a 10:30), cree UN SEUL evenement de 120 minutes. Ne le decoupe PAS en 2 blocs de 1h.

4. WEEKENDS :
   - PAS d'evenements le samedi ou dimanche SAUF si le texte/l'image l'indique EXPLICITEMENT (ex: "samedi 5 juillet : examen" ou un rendez-vous note ce jour-la).

5. VALIDATION FINALE :
   - Avant de retourner le JSON, RELIS chaque evenement et verifie :
     a) L'heure de debut est-elle AVANT l'heure de fin ? (SAUF si l'evenement traverse minuit, ex: de 17:00 a 01:00, ce qui est tout a fait valide pour les shifts de nuit).
     b) Y a-t-il un doublon avec un autre evenement dans ta liste ?
   - Si un evenement echoue a l'une de ces verifications, SUPPRIME-LE.

=== FORMAT DE SORTIE ===
Retourne UNIQUEMENT un JSON valide, sans markdown, sans commentaire :
{
  "events": [
    {
      "titre": "Nom clair et simple du cours/evenement",
      "date_absolue": "YYYY-MM-DD",
      "heure_debut": "HH:MM",
      "heure_fin": "HH:MM",
      "duree_minutes": 120,
      "lieu": "physique / visio / telephone / null",
      "lien_visio": "url ou null",
      "participants": [],
      "priorite": "normale / haute / critique / basse",
      "type": "cours / reunion / deadline / tache / rappel",
      "source": "image_scan / web / document",
      "notes": "contexte utile ou null",
      "categorie": "${categoriesStr}"
    }
  ]
}

Si AUCUN evenement valide n'est detecte, retourne : {"events": []}
`;
}

function cleanAndParseResponse(rawText) {
  logDebug(`Raw Gemini Response:\n${rawText}\n--- END RAW ---`);
  const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanedText);

  if (parsed.events) {
    // Post-processing : supprimer les doublons (meme date + meme heure debut)
    const seen = new Set();
    parsed.events = parsed.events.filter(e => {
      const key = `${e.date_absolue}-${e.heure_debut}-${e.titre}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return parsed;
}

async function extractEventsFromText(text, currentDate, timezone, categoriesList = [], userProfileContext = '') {
  try {
    const today = new Date(currentDate + 'T12:00:00');
    const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jourAujourdhui = joursSemaine[today.getDay()];

    const prompt = `
=== CONTEXTE TEMPOREL ===
Date du jour : ${currentDate} (${jourAujourdhui})
Fuseau horaire : ${timezone}

=== TEXTE A ANALYSER ===
"""
${text}
"""

RAPPEL : Sois RIGOUREUX. Verifie chaque date et chaque heure.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: getSystemPrompt(categoriesList, userProfileContext),
        responseMimeType: 'application/json'
      }
    });

    return cleanAndParseResponse(response.text);
  } catch (error) {
    console.error('Error in AI text extraction:', error);
    throw new Error('Erreur API Gemini: ' + error.message);
  }
}

async function extractEventsFromImage(imageBase64, mimeType, currentDate, timezone, categoriesList = [], userProfileContext = '') {
  try {
    const today = new Date(currentDate + 'T12:00:00');
    const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jourAujourdhui = joursSemaine[today.getDay()];

    const prompt = `
=== CONTEXTE TEMPOREL ===
Date du jour : ${currentDate} (${jourAujourdhui})
Fuseau horaire : ${timezone}

=== CONSIGNE ===
Analyse cette capture d'ecran d'un planning ou d'une autre application (notes, agenda, rappels).
Extrais tous les evenements, dates et horaires visibles dans l'image.
Convertis-les en dates absolues (YYYY-MM-DD) et horaires au format 24h (HH:MM).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType
          }
        },
        prompt
      ],
      config: {
        systemInstruction: getSystemPrompt(categoriesList, userProfileContext),
        responseMimeType: 'application/json'
      }
    });

    return cleanAndParseResponse(response.text);
  } catch (error) {
    console.error('Error in AI image extraction:', error);
    throw new Error('Erreur API Gemini (Vision): ' + error.message);
  }
}

async function generatePeriodReport(events, startDate, endDate, userProfileContext = '') {
  try {
    const profileSection = userProfileContext 
      ? `\nPrends en compte le profil et la situation de vie de l'utilisateur pour formuler des conseils et analyses ultra-personnalisés : "${userProfileContext}"\n`
      : '';

    const prompt = `
Tu es un consultant expert en analyse de temps et en optimisation de planning.
Génère un rapport de synthèse professionnel en français pour la période du ${startDate} au ${endDate}.
${profileSection}
Voici la liste des événements enregistrés dans le planning pour cette période :
${JSON.stringify(events, null, 2)}

Rédige un rapport structuré en Markdown contenant :
1. **Résumé exécutif** : Un paragraphe de synthèse de la période.
2. **Statistiques Clés** :
   - Nombre total de shifts / cours / activités.
   - Total des heures effectuées.
   - Durée moyenne d'une activité.
   - Journée la plus chargée.
3. **Analyse de la répartition** : Analyse par catégorie ou type d'activité avec le pourcentage de temps alloué à chacun.
4. **Observations et recommandations** : Conseils sur l'équilibre de vie, l'optimisation des horaires ou la détection de surmenage / conflits.

Utilise des tableaux Markdown pour la présentation des chiffres et des puces claires pour les conseils. Sois direct, professionnel et motivant.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return { report: response.text };
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('Erreur API Gemini (Rapport): ' + error.message);
  }
}

module.exports = {
  extractEventsFromText,
  extractEventsFromImage,
  generatePeriodReport
};
