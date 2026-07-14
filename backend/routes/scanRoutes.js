const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const db = require('../database/db');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const logFile = path.join(__dirname, '../debug.log');
function logDebug(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

function getCategories(userId) {
  return new Promise((resolve) => {
    db.all(`SELECT * FROM categories WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)`, [userId, userId], (err, rows) => {
      if (err) return resolve([]);
      resolve(rows || []);
    });
  });
}

function getProfile(userId) {
  return new Promise((resolve) => {
    if (userId) {
      db.get(`SELECT value FROM user_settings WHERE user_id = ? AND key = 'lifestyle_context'`, [userId], (err, row) => {
        if (err) return resolve('');
        resolve(row ? row.value : '');
      });
    } else {
      db.get(`SELECT value FROM user_profile WHERE key = 'lifestyle_context'`, (err, row) => {
        if (err) return resolve('');
        resolve(row ? row.value : '');
      });
    }
  });
}

router.post('/', async (req, res) => {
  try {
    const { text, type, currentDate, timezone, imageBase64, mimeType } = req.body;
    const today = currentDate || new Date().toISOString().split('T')[0];
    const tz = timezone || 'Europe/Paris';
    const userId = req.user ? req.user.id : null;

    // Check plan quotas
    let isFreeUser = false;
    if (req.user) {
      const user = await new Promise((resolve) => {
        db.get(`SELECT subscription_plan, scan_count_this_month FROM users WHERE id = ?`, [req.user.id], (err, row) => {
          resolve(row || null);
        });
      });

      if (user) {
        if (user.subscription_plan === 'free') {
          isFreeUser = true;
          if (user.scan_count_this_month >= 5) {
            return res.status(403).json({ 
              success: false, 
              error: 'quota_exceeded',
              message: 'Vous avez atteint la limite de 5 scans ce mois-ci avec votre forfait Gratuit. Veuillez passer à un forfait supérieur (Pro ou Premium).' 
            });
          }
        }
      }
    }

    const categoriesList = await getCategories(userId);
    const userProfileContext = await getProfile(userId);

    let finalData = null;

    // 1. SCAN D'IMAGE (VISION MULTIMODALE GEMINI)
    if (type === 'image' || imageBase64) {
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image base64 content is required for type=image' });
      }
      logDebug(`Received image scan request. MimeType: ${mimeType || 'image/jpeg'}`);
      
      const extractionResult = await aiService.extractEventsFromImage(
        imageBase64, 
        mimeType || 'image/jpeg', 
        today, 
        tz,
        categoriesList,
        userProfileContext
      );

      finalData = extractionResult;
    }
    
    // 2. SCAN DE TEXTE CLASSIQUE
    if (!finalData) {
      if (!text) {
        logDebug("ERROR: Scan request received with no text content.");
        return res.status(400).json({ error: 'Text content is required' });
      }

      logDebug(`Received scan request. Text length: ${text.length}.`);

      let finalContent = text.trim();

      // DETECTION ET PARSING DIRECT DES LIENS ICAL (.ics)
      let parsedDirect = false;
      if (finalContent.startsWith('http') && (finalContent.includes('.ics') || finalContent.includes('/ical/'))) {
        logDebug(`iCal link detected: ${finalContent}. Downloading and parsing directly...`);
        try {
          const fetchResponse = await fetch(finalContent);
          if (!fetchResponse.ok) {
            throw new Error(`HTTP error! status: ${fetchResponse.status}`);
          }
          const icsText = await fetchResponse.text();
          
          // 1. Déplier les lignes coupées (folding standard iCal)
          const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
          
          // 2. Parser le fichier déplié
          const events = [];
          const blocks = unfolded.split('BEGIN:VEVENT');
          
          for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i].split('END:VEVENT')[0];
            const lines = block.split(/\r?\n/);
            
            let summary = '';
            let location = '';
            let description = '';
            let dtstart = '';
            let dtend = '';
            
            for (let line of lines) {
              if (line.startsWith('SUMMARY:')) summary = line.substring(8);
              else if (line.startsWith('SUMMARY;')) summary = line.substring(line.indexOf(':') + 1);
              else if (line.startsWith('LOCATION:')) location = line.substring(9);
              else if (line.startsWith('LOCATION;')) location = line.substring(line.indexOf(':') + 1);
              else if (line.startsWith('DESCRIPTION:')) description = line.substring(12);
              else if (line.startsWith('DESCRIPTION;')) description = line.substring(line.indexOf(':') + 1);
              else if (line.startsWith('DTSTART:')) dtstart = line.substring(8);
              else if (line.startsWith('DTSTART;')) dtstart = line.substring(line.indexOf(':') + 1);
              else if (line.startsWith('DTEND:')) dtend = line.substring(6);
              else if (line.startsWith('DTEND;')) dtend = line.substring(line.indexOf(':') + 1);
            }
            
            if (!dtstart) continue;
            
            const parseDateTime = (str) => {
              const match = str.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
              if (!match) return null;
              return {
                date: `${match[1]}-${match[2]}-${match[3]}`,
                time: `${match[4]}:${match[5]}`
              };
            };
            
            const startData = parseDateTime(dtstart);
            const endData = dtend ? parseDateTime(dtend) : null;
            
            if (!startData) continue;
            
            let duration = 60;
            if (startData && endData) {
              const startMin = parseInt(startData.time.split(':')[0]) * 60 + parseInt(startData.time.split(':')[1]);
              const endMin = parseInt(endData.time.split(':')[0]) * 60 + parseInt(endData.time.split(':')[1]);
              duration = Math.max(endMin - startMin, 0);
            }
            
            const cleanText = (str) => {
              if (!str) return null;
              return str
                .replace(/\\,/g, ',')
                .replace(/\\;/g, ';')
                .replace(/\\n/g, '\n')
                .replace(/\\/g, '')
                .trim();
            };
            
            events.push({
              titre: cleanText(summary) || 'Cours sans titre',
              date_absolue: startData.date,
              heure_debut: startData.time,
              heure_fin: endData ? endData.time : '',
              duree_minutes: duration,
              lieu: cleanText(location),
              lien_visio: null,
              participants: [],
              priorite: 'normale',
              type: 'cours',
              source: 'ical',
              notes: cleanText(description)
            });
          }
          
          logDebug(`Direct parsing successful. Extracted ${events.length} events.`);
          finalData = { events };
          parsedDirect = true;
        } catch (err) {
          logDebug(`Direct parsing failed: ${err.message}. Fallback to AI...`);
        }
      }

      if (!parsedDirect) {
        // Si c'est une URL classique (non ICS), on va chercher le contenu de la page web
        if (type === 'url') {
          try {
            const fetchResponse = await fetch(text);
            const html = await fetchResponse.text();
            finalContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                               .replace(/<[^>]*>?/gm, ' ')
                               .replace(/\s+/g, ' ')
                               .trim();
            
            if (finalContent.length > 50000) {
              finalContent = finalContent.substring(0, 50000);
            }
          } catch (err) {
            return res.status(400).json({ error: 'Impossible de lire cette URL' });
          }
        }

        const extractionResult = await aiService.extractEventsFromText(finalContent, today, tz, categoriesList, userProfileContext);
        finalData = extractionResult;
      }
    }

    // Increment scan usage count if successful and logged in
    if (req.user && isFreeUser) {
      db.run(`UPDATE users SET scan_count_this_month = scan_count_this_month + 1 WHERE id = ?`, [req.user.id]);
    }

    // Force notes to be null for all auto-extracted events (only user-initiated notes allowed)
    if (finalData && Array.isArray(finalData.events)) {
      finalData.events.forEach(e => {
        e.notes = null;
      });
    }

    res.json({
      success: true,
      data: finalData
    });
  } catch (error) {
    logDebug(`CRITICAL ERROR: ${error.message}\nStack: ${error.stack}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/report', async (req, res) => {
  try {
    const { events, startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate et endDate sont requis' });
    }
    const userId = req.user ? req.user.id : null;
    const userProfileContext = await getProfile(userId);
    const reportData = await aiService.generatePeriodReport(events, startDate, endDate, userProfileContext);
    res.json({ success: true, ...reportData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/coach', async (req, res) => {
  try {
    const { events, currentDate } = req.body;
    const userId = req.user ? req.user.id : null;
    const userProfileContext = await getProfile(userId);
    const insights = await aiService.generateCoachInsights(events, currentDate || new Date().toISOString().split('T')[0], userProfileContext);
    res.json({ success: true, ...insights });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
