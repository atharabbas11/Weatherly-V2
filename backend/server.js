import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import webpush from 'web-push';
import axios from 'axios';
import helmet from 'helmet';
import { MongoClient } from 'mongodb';
import weatherRouter from './weatherRoutes.js';

dotenv.config();

const app = express();
app.use(helmet());

// MongoDB connection setup
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);
let db, subscriptionsCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('weatherdb');
    subscriptionsCollection = db.collection('subscriptions');
    await subscriptionsCollection.createIndex({ endpoint: 1 }, { unique: true });
    await subscriptionsCollection.createIndex({ location: 1 });
    await subscriptionsCollection.createIndex({ userId: 1 }); // Add this line for user-specific subscriptions
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

connectDB();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

app.use(cors({
  origin: frontendUrl,
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// VAPID keys setup
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('Missing VAPID keys in environment variables');
  process.exit(1);
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:weather@example.com",
  vapidPublicKey,
  vapidPrivateKey
);

// Weather API Routes
app.use("/api/weather", weatherRouter);

// Push Notification Endpoints
app.post("/api/subscribe", async (req, res) => {
  try {
    const { subscription, location, userId } = req.body;
    
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Invalid subscription format" });
    }

    const normalizedLocation = location.replace(/\s*,\s*/g, ',');
    const now = new Date();

    const subDoc = {
      ...subscription,
      userId: userId || null, // Associate subscription with user
      createdAt: now,
      lastNotified: null,
      location: normalizedLocation,
      nextNotificationTime: calculateNextNotificationTime(now)
    };

    // Upsert subscription with user association
    await subscriptionsCollection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: subDoc },
      { upsert: true }
    );

    // Only send to this specific subscription, not all for location
    await sendWeatherUpdateForSubscription(subscription, normalizedLocation);
    
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Subscription error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/subscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;
    const result = await subscriptionsCollection.deleteOne({ endpoint });
    if (result.deletedCount > 0) {
      return res.status(200).json({ success: true });
    }
    return res.status(404).json({ error: "Subscription not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribe/check', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const exists = await subscriptionsCollection.findOne({ endpoint });
    if (exists) {
      return res.status(200).json({
        subscribed: true,
        location: exists.location
      });
    }
    res.status(404).end();
  } catch (err) {
    console.error('Subscription check error:', err);
    res.status(500).end();
  }
});

// Improved timezone handling functions
function getLocalHour(timezone) {
  try {
    const now = new Date();
    return parseInt(now.toLocaleString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false
    }));
  } catch (err) {
    console.error(`Error getting local hour for ${timezone}:`, err);
    return new Date().getUTCHours();
  }
}

function calculateNextNotificationTime(now, timezone) {
  const localHour = getLocalHour(timezone);
  const next = new Date(now);
  
  // Calculate next even hour in local time
  const nextNotificationHour = localHour + (2 - (localHour % 2));
  
  // Convert local time to UTC for storage
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  utcDate.setHours(nextNotificationHour, 0, 0, 0);
  return utcDate;
}

// Updated notification time formatting
function formatLocalTime(dateStr, timezone) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (err) {
    console.error('Error formatting time:', err);
    return dateStr;
  }
}

async function sendWeatherUpdateForSubscription(subscription, location) {
  try {
    const weatherData = await fetchWeatherData(location);
    const timezone = weatherData.location.tz_id;
    
    // Get current time in location's timezone
    const now = new Date();
    const localHour = parseInt(now.toLocaleString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false
    }));
    const nextHour = (localHour + 1) % 24;

    // Parse API times directly as local time (no conversion needed)
    const adjustedHourlyData = weatherData.forecast.forecastday[0].hour.map(hour => {
      // Extract hour directly from API time string (format: "YYYY-MM-DD HH:MM")
      const apiHour = parseInt(hour.time.split(' ')[1].split(':')[0]);
      
      return {
        ...hour,
        local_hour: apiHour,
        local_time: `${apiHour % 12 || 12}${apiHour >= 12 ? 'PM' : 'AM'}`
      };
    });

    const currentData = adjustedHourlyData.find(h => h.local_hour === localHour);
    const nextData = adjustedHourlyData.find(h => h.local_hour === nextHour);

    if (!currentData || !nextData) {
      throw new Error(`Could not find data for hours ${localHour} and ${nextHour}`);
    }

    await sendSingleNotification(subscription, location, currentData, nextData, weatherData.alerts?.alert || [], timezone);
  } catch (err) {
    console.error(`Update failed for ${location}:`, err);
    await sendNotification(subscription, {
      title: "Weather Update Failed",
      body: `Couldn't get weather for ${location.split(',')[0]}`,
      icon: '/icons/error.png'
    });
  }
}

function debugTimeConversion(weatherData) {
  const timezone = weatherData.location.tz_id;
  console.log('=== TIME CONVERSION DEBUG ===');
  console.log('Location:', weatherData.location.name, 'Timezone:', timezone);
  console.log('Current UTC time:', new Date().toISOString());
  
  // Check first 3 hourly entries
  weatherData.forecast.forecastday[0].hour.slice(0, 3).forEach(hour => {
    const utcDate = new Date(hour.time);
    console.log(`---`);
    console.log('API time field:', hour.time);
    console.log('As UTC:', utcDate.toISOString());
    console.log('As local time:', utcDate.toLocaleString('en-US', { timeZone: timezone }));
    console.log('Local hour:', parseInt(utcDate.toLocaleString('en-US', { 
      timeZone: timezone, 
      hour: '2-digit', 
      hour12: false 
    })));
  });
}

async function sendSingleNotification(subscription, location, currentData, nextData, alerts, timezone) {
  // Format times directly from API data (already in local time)
  const currentHour = parseInt(currentData.time.split(' ')[1].split(':')[0]);
  const nextHour = parseInt(nextData.time.split(' ')[1].split(':')[0]);
  
  const currentPeriod = currentHour >= 12 ? 'PM' : 'AM';
  const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
  
  const currentDisplayHour = currentHour % 12 || 12;
  const nextDisplayHour = nextHour % 12 || 12;
  
  const currentTime = `${currentDisplayHour} ${currentPeriod}`;
  const nextTime = `${nextDisplayHour} ${nextPeriod}`;

  // Current conditions notification
  await sendNotification(subscription, {
    title: `⏱️ ${currentTime} Weather (${location.split(',')[0]})`,
    body: `${currentData.temp_c}°C, ${currentData.condition.text}` +
          `\n☁️ Cloud: ${currentData.cloud}%` +
          `\n☔ Rain: ${currentData.chance_of_rain}%` +
          `\n🌬️ Wind: ${currentData.wind_kph} kph ${currentData.wind_dir}`,
    icon: currentData.condition.icon,
    data: { 
      type: 'current_weather', 
      location,
      time: currentTime,
      timezone // Include timezone in notification data
    }
  });

  // Forecast notification
  await sendNotification(subscription, {
    title: `🔮 ${nextTime} Forecast (${location.split(',')[0]})`,
    body: `Expected: ${nextData.temp_c}°C, ${nextData.condition.text}` +
          `\n☁️ Cloud: ${nextData.cloud}%` +
          `\n☔ Rain: ${nextData.chance_of_rain}%` +
          `\n🌬️ Wind: ${nextData.wind_kph} kph ${nextData.wind_dir}`,
    icon: nextData.condition.icon,
    data: { 
      type: 'forecast', 
      location, 
      time: nextTime,
      timezone // Include timezone in notification data
    }
  });

  // Send alerts if any
  for (const alert of alerts) {
    await sendNotification(subscription, createAlertNotification(alert, location));
  }

  // Update last notified time
  await subscriptionsCollection.updateOne(
    { endpoint: subscription.endpoint },
    { $set: { 
      lastNotified: new Date(),
      nextNotificationTime: calculateNextNotificationTime(new Date(), timezone)
    }}
  );
}

async function fetchWeatherData(location) {
  try {
    const [city, region, country] = location.split(',');
    const apiUrl = `${backendUrl}/api/weather/city`;
    
    const response = await axios.get(apiUrl, {
      params: { 
        name: city.trim(),
        region: region.trim(),
        country: country.trim()
      }
    });
    
    return response.data;
  } catch (err) {
    console.error('Weather API Error:', err.message);
    throw err;
  }
}

async function sendNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await subscriptionsCollection.deleteOne({ endpoint: subscription.endpoint });
    }
    return false;
  }
}

function createAlertNotification(alert, location) {
  const effective = new Date(alert.effective).toLocaleString();
  const expires = new Date(alert.expires).toLocaleString();
  
  return {
    title: `⚠️ ${alert.event} - ${location.split(',')[0]}`,
    body: `${alert.headline}\n\n` +
          `Severity: ${alert.severity}\n` +
          `Effective: ${effective}\n` +
          `Expires: ${expires}\n\n` +
          `${alert.desc}\n\n` +
          `${alert.instruction || ''}`,
    icon: '/icons/alert.png',
    data: {
      type: 'weather_alert',
      location: location,
      event: alert.event,
      severity: alert.severity
    }
  };
}

async function sendTwoHourWeatherUpdates() {
  try {
    const allSubs = await subscriptionsCollection.find({}).toArray();

    if (allSubs.length === 0) {
      return;
    }

    // Process each subscription individually
    for (const sub of allSubs) {
      try {
        const weatherData = await fetchWeatherData(sub.location);
        const timezone = weatherData.location.tz_id;
        
        const localHour = parseInt(new Date().toLocaleString('en-US', {
          hour: '2-digit',
          hour12: false,
          timeZone: timezone
        }));
        
        const nextHour = (localHour + 1) % 24;

        const adjustedHourlyData = weatherData.forecast.forecastday[0].hour.map(hour => {
          const utcDate = new Date(hour.time);
          const localHour = utcDate.toLocaleString('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            hour12: false
          }).split(':')[0];
          
          return {
            ...hour,
            local_hour: parseInt(localHour),
            local_time: utcDate.toLocaleTimeString('en-US', {
              timeZone: timezone,
              hour12: true
            })
          };
        });

        const currentData = adjustedHourlyData.find(h => h.local_hour === localHour);
        const nextData = adjustedHourlyData.find(h => h.local_hour === nextHour);

        if (!currentData || !nextData) {
          throw new Error('Missing hourly data');
        }

        const activeAlerts = weatherData.alerts?.alert || [];
        
        // Send to this specific subscription only
        await sendSingleNotification(sub, sub.location, currentData, nextData, activeAlerts, timezone);
      } catch (err) {
        console.error(`Failed to process ${sub.location} for ${sub.endpoint}:`, err.message);
        
        await sendNotification(sub, {
          title: "Weather Update Failed",
          body: `We couldn't get the latest weather for ${sub.location.split(',')[0]}`,
          icon: '/icons/error.png'
        });
      }
    }
  } catch (err) {
    console.error('Critical scheduler error:', err);
  }
}

function scheduleTwoHourWeatherUpdates() {
  const now = new Date();
  const currentHour = now.getHours();
  const minutesToNextUpdate = (120 - (currentHour % 2 * 60 + now.getMinutes())) % 120;

  setTimeout(() => {
    sendTwoHourWeatherUpdates();
    setInterval(sendTwoHourWeatherUpdates, 2 * 60 * 60 * 1000);
  }, minutesToNextUpdate * 60 * 1000);
}

scheduleTwoHourWeatherUpdates();

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
