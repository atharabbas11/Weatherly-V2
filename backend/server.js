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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// MongoDB setup
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri);
let db, subscriptionsCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('weatherdb');
    subscriptionsCollection = db.collection('subscriptions');
    await subscriptionsCollection.createIndex({ endpoint: 1 }, { unique: true });
    await subscriptionsCollection.createIndex({ deviceId: 1 });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}
connectDB();

// VAPID setup
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('Missing VAPID keys');
  process.exit(1);
}
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:weather@example.com",
  vapidPublicKey,
  vapidPrivateKey
);

// Routes
app.use("/api/weather", weatherRouter);

// Subscription endpoints
app.post("/api/subscribe", async (req, res) => {
  try {
    const { subscription, location, deviceId } = req.body;
    
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Invalid subscription format" });
    }

    const normalizedLocation = location.replace(/\s*,\s*/g, ',');
    const now = new Date();

    const subDoc = {
      ...subscription,
      deviceId: deviceId || 'unknown-device',
      createdAt: now,
      lastNotified: null,
      location: normalizedLocation,
      nextNotificationTime: calculateNextNotificationTime(now, normalizedLocation)
    };

    await subscriptionsCollection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: subDoc },
      { upsert: true }
    );

    await sendWeatherUpdateForSubscription(subscription, normalizedLocation, deviceId);
    
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
    res.status(result.deletedCount > 0 ? 200 : 404).json({ 
      success: result.deletedCount > 0 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscribe/check', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const exists = await subscriptionsCollection.findOne({ endpoint });
    res.status(exists ? 200 : 404).json(exists || {});
  } catch (err) {
    console.error('Subscription check error:', err);
    res.status(500).end();
  }
});

// Helper functions
function getLocalHour(timezone) {
  return parseInt(new Date().toLocaleString('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: timezone
  }));
}

function calculateNextNotificationTime(now, location) {
  // This will be updated after first weather fetch
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

async function sendWeatherUpdateForSubscription(subscription, location, deviceId) {
  try {
    const weatherData = await fetchWeatherData(location);
    const timezone = weatherData.location.tz_id;
    
    // Update next notification time with proper timezone
    const now = new Date();
    const nextNotificationTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    nextNotificationTime.setHours(nextNotificationTime.getHours() + 2, 0, 0, 0);
    
    await subscriptionsCollection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { nextNotificationTime } }
    );

    const localHour = getLocalHour(timezone);
    const nextHour = (localHour + 1) % 24;

    const adjustedHourlyData = weatherData.forecast.forecastday[0].hour.map(hour => {
      const utcDate = new Date(hour.time);
      const hourLocal = parseInt(utcDate.toLocaleString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hour12: false
      }));
      
      return {
        ...hour,
        local_hour: hourLocal,
        local_time: utcDate.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour12: true
        })
      };
    });

    const currentData = adjustedHourlyData.find(h => h.local_hour === localHour);
    const nextData = adjustedHourlyData.find(h => h.local_hour === nextHour);

    if (!currentData || !nextData) {
      throw new Error(`Data not found for hours ${localHour} and ${nextHour}`);
    }

    const activeAlerts = weatherData.alerts?.alert || [];
    const subscriber = await subscriptionsCollection.findOne({ 
      endpoint: subscription.endpoint,
      deviceId: deviceId
    });

    if (subscriber) {
      await sendLocationNotifications(
        location,
        { ...currentData, timezone },
        { ...nextData, timezone },
        activeAlerts,
        [subscriber] // Only send to this specific device
      );
    }
  } catch (err) {
    console.error(`Failed to send update for ${location}:`, err);
    await sendNotification(subscription, {
      title: "Weather Update Failed",
      body: `Couldn't get latest weather for ${location.split(',')[0]}`,
      icon: '/icons/error.png'
    });
  }
}

async function sendLocationNotifications(location, currentHourData, nextHourData, alerts = [], specificSubscribers = null) {
  const timezone = currentHourData.timezone || 'UTC';
  const subscribers = specificSubscribers || await subscriptionsCollection.find({ location }).toArray();

  if (subscribers.length === 0) return;

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      timeZone: timezone,
      hour: 'numeric',
      hour12: true 
    }).replace(/:00 /, ' ').replace(/:\d+ /, ' ');
  };

  const currentTime = formatTime(currentHourData.time);
  const nextTime = formatTime(nextHourData.time);

  // Current weather notification
  await sendBatchNotifications(subscribers, {
    title: `⏱️ ${currentTime} Weather (${location.split(',')[0]})`,
    body: `${currentHourData.temp_c}°C, ${currentHourData.condition.text}`,
    icon: currentHourData.condition.icon,
    data: { type: 'current_weather', location }
  });

  // Forecast notification
  await sendBatchNotifications(subscribers, {
    title: `🔮 ${nextTime} Forecast (${location.split(',')[0]})`,
    body: `Expected: ${nextHourData.temp_c}°C, ${nextHourData.condition.text}`,
    icon: nextHourData.condition.icon,
    data: { type: 'forecast', location }
  });

  // Alerts
  for (const alert of alerts) {
    await sendBatchNotifications(subscribers, {
      title: `⚠️ ${alert.event} - ${location.split(',')[0]}`,
      body: `${alert.headline}\n\n${alert.desc}`,
      icon: '/icons/alert.png',
      data: { type: 'alert', location }
    });
  }

  // Update last notified time
  const now = new Date();
  await subscriptionsCollection.updateMany(
    { endpoint: { $in: subscribers.map(s => s.endpoint) } },
    { $set: { lastNotified: now } }
  );
}

async function sendBatchNotifications(subscribers, payload) {
  return Promise.allSettled(
    subscribers.map(sub => 
      webpush.sendNotification(sub, JSON.stringify(payload))
        .catch(err => {
          if ([404, 410].includes(err.statusCode)) {
            subscriptionsCollection.deleteOne({ endpoint: sub.endpoint });
          }
          throw err;
        })
    )
  );
}

// Scheduler
function scheduleTwoHourWeatherUpdates() {
  const now = new Date();
  const minsToNextUpdate = (120 - (now.getMinutes() + (now.getHours() % 2 * 60))) % 120;
  
  setTimeout(() => {
    sendTwoHourWeatherUpdates();
    setInterval(sendTwoHourWeatherUpdates, 2 * 60 * 60 * 1000);
  }, minsToNextUpdate * 60 * 1000);
}

async function sendTwoHourWeatherUpdates() {
  try {
    const allSubs = await subscriptionsCollection.find({}).toArray();
    
    // Process each subscription individually
    for (const sub of allSubs) {
      try {
        const weatherData = await fetchWeatherData(sub.location);
        const timezone = weatherData.location.tz_id;
        const localHour = getLocalHour(timezone);
        const nextHour = (localHour + 1) % 24;

        const currentData = weatherData.forecast.forecastday[0].hour
          .find(h => new Date(h.time).getHours() === localHour);
        const nextData = weatherData.forecast.forecastday[0].hour
          .find(h => new Date(h.time).getHours() === nextHour);

        if (currentData && nextData) {
          await sendLocationNotifications(
            sub.location,
            { ...currentData, timezone },
            { ...nextData, timezone },
            weatherData.alerts?.alert || [],
            [sub] // Only send to this subscription
          );
        }
      } catch (err) {
        console.error(`Error processing ${sub.location}:`, err);
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

scheduleTwoHourWeatherUpdates();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
