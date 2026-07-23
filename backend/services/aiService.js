const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../debug.log');
function logDebug(msg) {
  fs.appendFile(logFile, `[${new Date().toISOString()}] ${msg}\n`, () => {});
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

async function autoScheduleTasks(tasks, existingEvents, categoriesList, currentDate, timezone, userProfileContext = '') {
  try {
    const prompt = `
=== CONTEXTE ===
Date de reference (lundi de la semaine actuelle) : ${currentDate}
Fuseau horaire : ${timezone}
${userProfileContext ? `Profil utilisateur: ${userProfileContext}` : ''}

Tu es un assistant IA expert en productivite et gestion du temps.
Ton objectif est de planifier une liste de tâches (qui n'ont pas encore de date/heure) dans la semaine en cours, en evitant les conflits avec les evenements deja existants.

=== EVENEMENTS DEJA PLANIFIES (Ne pas ecraser) ===
${JSON.stringify(existingEvents.map(e => ({
  titre: e.titre,
  date: e.date_absolue,
  debut: e.heure_debut,
  fin: e.heure_fin
})), null, 2)}

=== TACHES A PLANIFIER ===
${JSON.stringify(tasks.map(t => ({
  id: t.id,
  titre: t.title,
  duree_minutes: t.duration_minutes,
  priorite: t.priority
})), null, 2)}

=== CONTRAINTES DE PLANIFICATION ===
1. Ne planifie des tâches qu'entre 08:00 et 22:00.
2. Ne mets jamais deux evenements ou tâches en meme temps (pas de chevauchement). Laisse au moins 15 minutes de pause entre chaque element si possible.
3. Repartis les tâches intelligemment sur la semaine (Lundi a Dimanche a partir de la date de reference). Ne mets pas tout le meme jour.
4. Les tâches avec la priorite "haute" ou "critique" doivent etre placees le plus tot possible dans la semaine.
5. Utilise les categories fournies si pertinent: ${categoriesList.map(c => c.name).join(' / ')}. Par defaut, utilise "Travail" ou "Tâche".

=== FORMAT DE SORTIE ATTENDU ===
Retourne UNIQUEMENT un JSON valide, sans markdown, sans commentaire :
{
  "scheduled_tasks": [
    {
      "task_id": 1,
      "titre": "Titre de la tâche",
      "date_absolue": "YYYY-MM-DD",
      "heure_debut": "HH:MM",
      "heure_fin": "HH:MM",
      "duree_minutes": 60,
      "categorie": "Tâche"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error in AI auto-scheduling:', error);
    throw new Error('Erreur API Gemini (Auto-Schedule): ' + error.message);
  }
}

async function chatWithAI(message, existingEvents, currentDate, timezone, userProfileContext = '') {
  try {
    const prompt = `
Tu es un assistant de planning intelligent, amical et efficace. L'utilisateur te parle en langage naturel.
Date du jour : ${currentDate}
Fuseau horaire : ${timezone}
${userProfileContext ? `Profil utilisateur: ${userProfileContext}` : ''}

=== EVENEMENTS ACTUELS DE L'UTILISATEUR ===
${JSON.stringify(existingEvents.map(e => ({
  titre: e.titre,
  date: e.date_absolue,
  debut: e.heure_debut,
  fin: e.heure_fin,
  categorie: e.categorie
})), null, 2)}

=== MESSAGE DE L'UTILISATEUR ===
"${message}"

=== INSTRUCTIONS ===
Analyse le message de l'utilisateur. Tu as 2 modes de reponse possibles :

1. MODE ACTION : Si l'utilisateur demande de creer, ajouter, ou planifier un evenement, retourne un JSON avec "action": "create_events" et la liste des evenements a creer.
2. MODE REPONSE : Si l'utilisateur pose une question ("quand suis-je libre ?", "combien d'heures ai-je travaille ?"), retourne un JSON avec "action": "answer" et ta reponse textuelle.

Format de sortie (JSON strict) :
{
  "action": "create_events" | "answer",
  "response": "Ta reponse textuelle a afficher a l'utilisateur (toujours present)",
  "events": [
    {
      "titre": "...",
      "date_absolue": "YYYY-MM-DD",
      "heure_debut": "HH:MM",
      "heure_fin": "HH:MM",
      "duree_minutes": 60,
      "categorie": "..."
    }
  ]
}
Si action = "answer", le champ "events" peut etre vide ou absent.
Reponds TOUJOURS en francais.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error in AI chat:', error);
    throw new Error('Erreur API Gemini (Chat): ' + error.message);
  }
}

async function breakdownProject(projectDescription, currentDate, timezone, userProfileContext = '') {
  try {
    const prompt = `
Tu es un expert en gestion de projets et planification strategique.
Date du jour : ${currentDate}
Fuseau horaire : ${timezone}
${userProfileContext ? `Profil utilisateur: ${userProfileContext}` : ''}

=== OBJECTIF DU PROJET ===
"${projectDescription}"

=== INSTRUCTIONS ===
Decompose cet objectif en sous-taches concretes et actionnables.
Chaque sous-tache doit avoir :
- Un titre clair et precis
- Une duree estimee en minutes (entre 30 et 180 min)
- Une priorite (haute pour les premieres etapes, normale pour le reste)
- Un ordre logique de realisation

Genere entre 5 et 15 sous-taches selon la complexite du projet.
Repartis-les sur 1 a 8 semaines a partir de la date du jour.

Format de sortie (JSON strict) :
{
  "project_title": "Titre du projet",
  "summary": "Resume du plan en 2-3 phrases",
  "total_estimated_hours": 10,
  "tasks": [
    {
      "titre": "Nom de la sous-tache",
      "duree_minutes": 60,
      "priorite": "haute" | "normale" | "basse",
      "semaine": 1,
      "description": "Breve description de ce qu'il faut faire"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error in AI project breakdown:', error);
    throw new Error('Erreur API Gemini (Breakdown): ' + error.message);
  }
}

async function generateCoachInsights(events, currentDate, userProfileContext = '') {
  try {
    const prompt = `
Tu es un coach de vie bienveillant mais honnete, expert en equilibre vie pro/perso, productivite et bien-etre.
Date du jour : ${currentDate}
${userProfileContext ? `Profil de l'utilisateur: ${userProfileContext}` : ''}

=== EVENEMENTS DES 7 DERNIERS JOURS ===
${JSON.stringify(events.map(e => ({
  titre: e.titre,
  date: e.date_absolue,
  debut: e.heure_debut,
  fin: e.heure_fin,
  categorie: e.categorie,
  type: e.type
})), null, 2)}

=== INSTRUCTIONS ===
Analyse la semaine de l'utilisateur et genere des conseils personnalises.
Ton analyse doit couvrir :
1. Score d'equilibre (sur 10) avec justification
2. Points positifs (ce qui va bien)
3. Points d'attention (surmenage, manque de repos, etc.)
4. 3 conseils concrets et actionnables pour la semaine prochaine
5. Une phrase de motivation personnalisee

Format de sortie (JSON strict) :
{
  "score": 7,
  "score_label": "Bon equilibre",
  "positifs": ["Point 1", "Point 2"],
  "alertes": ["Alerte 1"],
  "conseils": [
    {
      "titre": "Titre du conseil",
      "description": "Description detaillee",
      "icon": "rest" | "sport" | "work" | "social" | "health"
    }
  ],
  "motivation": "Phrase de motivation"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text;
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error in AI coach:', error);
    throw new Error('Erreur API Gemini (Coach): ' + error.message);
  }
}

module.exports = {
  extractEventsFromText,
  extractEventsFromImage,
  generatePeriodReport,
  autoScheduleTasks,
  chatWithAI,
  breakdownProject,
  generateCoachInsights
};
