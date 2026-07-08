const { google } = require('googleapis');

// Configuration OAuth2 Google
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Générer l'URL d'authentification
function getAuthUrl(state) {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent'
  });
}

// Échanger le code contre un token
async function getTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

// Créer un événement dans Google Calendar
async function createEvent(tokens, eventDetails) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oAuth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

  // Format the dates
  const startDate = `${eventDetails.date_absolue}T${eventDetails.heure_debut || '09:00'}:00`;
  let endDate;
  
  if (eventDetails.heure_fin) {
    endDate = `${eventDetails.date_absolue}T${eventDetails.heure_fin}:00`;
  } else {
    // Si pas d'heure de fin, on ajoute la durée (défaut 60 min)
    const start = new Date(startDate);
    const duree = eventDetails.duree_minutes || 60;
    const end = new Date(start.getTime() + duree * 60000);
    endDate = end.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
  }

  const event = {
    summary: eventDetails.titre,
    location: eventDetails.lieu || '',
    description: eventDetails.notes || '',
    start: {
      dateTime: startDate,
      timeZone: process.env.TIMEZONE || 'Europe/Paris',
    },
    end: {
      dateTime: endDate,
      timeZone: process.env.TIMEZONE || 'Europe/Paris',
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });

  return response.data;
}

module.exports = {
  getAuthUrl,
  getTokens,
  createEvent
};
