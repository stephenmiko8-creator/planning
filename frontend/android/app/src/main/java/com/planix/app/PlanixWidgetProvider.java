package com.mikiplan.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MikiplanWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mikiplan);
        views.setTextViewText(R.id.widget_event_name, "Chargement...");
        appWidgetManager.updateAppWidget(appWidgetId, views);

        new Thread(() -> {
            try {
                // Capacitor stores preferences in a specific SharedPreferences file
                SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String token = prefs.getString("token", null);

                if (token == null) {
                    views.setTextViewText(R.id.widget_event_name, "Non connecté");
                    appWidgetManager.updateAppWidget(appWidgetId, views);
                    return;
                }

                // Using production Render URL for real device
                URL url = new URL("https://planning-backend-w5of.onrender.com/api/events/all");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                
                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        response.append(line);
                    }
                    in.close();

                    JSONArray events = new JSONArray(response.toString());
                    
                    // Simple logic to find next event
                    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.FRANCE);
                    Date now = new Date();
                    JSONObject nextEvent = null;
                    Date nextEventDate = null;

                    for (int i = 0; i < events.length(); i++) {
                        JSONObject event = events.getJSONObject(i);
                        String dateStr = event.getString("date_absolue") + " " + event.getString("heure_debut");
                        Date evDate = sdf.parse(dateStr);
                        
                        if (evDate != null && evDate.after(now)) {
                            if (nextEvent == null || evDate.before(nextEventDate)) {
                                nextEvent = event;
                                nextEventDate = evDate;
                            }
                        }
                    }

                    if (nextEvent != null) {
                        views.setTextViewText(R.id.widget_event_name, nextEvent.getString("titre"));
                        views.setTextViewText(R.id.widget_event_time, nextEvent.getString("date_absolue") + " à " + nextEvent.getString("heure_debut"));
                    } else {
                        views.setTextViewText(R.id.widget_event_name, "Aucun événement prévu");
                        views.setTextViewText(R.id.widget_event_time, "--");
                    }
                } else {
                    views.setTextViewText(R.id.widget_event_name, "Erreur serveur");
                }
            } catch (Exception e) {
                e.printStackTrace();
                views.setTextViewText(R.id.widget_event_name, "Erreur réseau");
            }
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }).start();
    }
}
