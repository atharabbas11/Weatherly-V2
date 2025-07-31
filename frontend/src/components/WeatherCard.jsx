import { useState, useEffect } from "react";
import { getSvgForWeather } from "../utils/getWeatherSvgIcon";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { IoTime } from "react-icons/io5";
import { SlCalender } from "react-icons/sl";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { WiSunrise, WiSunset, WiMoonrise, WiMoonset } from "react-icons/wi";
import { FaTemperatureHigh, FaTemperatureLow, FaWind, FaTint, FaEye, FaCloud, FaUmbrella } from "react-icons/fa";
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import toast from "react-hot-toast";

const WeatherCard = ({ weather, onSave, isSaved }) => {
  const { location, current, forecast, alerts } = weather;
  const [showAQI, setShowAQI] = useState(false);
  const [showHourly, setShowHourly] = useState(false);
  const [showAstro, setShowAstro] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const backendUrl = import.meta.env.VITE_API_URL;
  const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  
  const weatherIcon = getSvgForWeather(current.condition.code, current.is_day);
  const aqi = current.air_quality;

  // Date & Time
  const formattedDate = new Date(location.localtime);
  const day = String(formattedDate.getDate()).padStart(2, '0');
  const month = String(formattedDate.getMonth() + 1).padStart(2, '0');
  const year = formattedDate.getFullYear();
  const formattedLocalDate = `${day}-${month}-${year}`;

  const hours24 = formattedDate.getHours();
  const minutes = String(formattedDate.getMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const formattedLocalTime = `${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;

  // Define helper functions first
  const formatLocalTime = (timeString, timezone) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone
    });
  };

  // Helper function to get current hour in specific timezone
  const getCurrentHourInTimezone = (timezone) => {
    return parseInt(new Date().toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    }));
  };

  // Process today's forecast data with local hour mapping
  const todayHourlyForecast = forecast.forecastday[0].hour.map(h => ({
    ...h,
    local_hour: parseInt(new Date(h.time).toLocaleString('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone: location.tz_id
    }))
  }));

  // In your component:
  const currentLocalHour = getCurrentHourInTimezone(location.tz_id);
  const nextLocalHour = (currentLocalHour + 1) % 24;

  const currentData = todayHourlyForecast.find(h => h.local_hour === currentLocalHour);
  const nextData = todayHourlyForecast.find(h => h.local_hour === nextLocalHour);

  // For debugging:
  console.log(`Location: ${location.name}, Timezone: ${location.tz_id}`);
  console.log(`Current local hour: ${currentLocalHour}`);
  console.log(`Next local hour: ${nextLocalHour}`);
  console.log('Current data:', currentData);
  console.log('Next data:', nextData);


  // Hourly Weather Slider
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    adaptiveHeight: true
  };

  // Get today's hourly forecast
  // const todayHourlyForecast = forecast?.forecastday[0]?.hour || [];
  const todayAstro = forecast?.forecastday[0]?.astro || {};

  // Get alerts if any
  const hasAlerts = alerts?.alert?.length > 0;

  // EPA Index mapping
  const epaIndexMap = {
    1: { label: "Good", color: "text-green-500" },
    2: { label: "Moderate", color: "text-yellow-500" },
    3: { label: "Unhealthy for Sensitive Groups", color: "text-orange-500" },
    4: { label: "Unhealthy", color: "text-red-500" },
    5: { label: "Very Unhealthy", color: "text-purple-500" },
    6: { label: "Hazardous", color: "text-maroon-500" }
  };

  // DEFRA Index mapping
  const defraIndexMap = {
    1: { label: "Low", color: "text-green-500" },
    2: { label: "Low", color: "text-green-500" },
    3: { label: "Low", color: "text-green-500" },
    4: { label: "Moderate", color: "text-yellow-500" },
    5: { label: "Moderate", color: "text-yellow-500" },
    6: { label: "Moderate", color: "text-yellow-500" },
    7: { label: "High", color: "text-orange-500" },
    8: { label: "High", color: "text-orange-500" },
    9: { label: "High", color: "text-orange-500" },
    10: { label: "Very High", color: "text-red-500" }
  };

  const moonIcons = {
    "New Moon": "/icons/moon-new.svg",
    "Waxing Crescent": "/icons/moon-waxing-crescent.svg",
    "First Quarter": "/icons/moon-first-quarter.svg",
    "Waxing Gibbous": "/icons/moon-waxing-gibbous.svg",
    "Full Moon": "/icons/moon-full.svg",
    "Waning Gibbous": "/icons/moon-waning-gibbous.svg",
    "Last Quarter": "/icons/moon-last-quarter.svg",
    "Waning Crescent": "/icons/moon-waning-crescent.svg",
  };

  const moonIconSrc = moonIcons[todayAstro.moon_phase];

  // Helper function for VAPID key conversion
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [subscriptionData, setSubscriptionData] = useState({
    isSubscribed: false,
    subscription: null,
    subscribedLocation: null
  });

  // const renderNotificationToggle = () => {
  //   if (!('Notification' in window)) return null;

  //   // Check if we're subscribed to THIS location
  //   const currentLocation = `${location.name},${location.region},${location.country}`.replace(/\s*,\s*/g, ',');
  //   const isSubscribedToCurrentLocation = subscriptionData.isSubscribed && 
  //     subscriptionData.subscribedLocation === currentLocation;

  //   return (
  //     <div className="notification-controls">
  //       <button
  //         onClick={isSubscribedToCurrentLocation ? unsubscribeFromNotifications : subscribeToNotifications}
  //         className={`notification-btn ${isSubscribedToCurrentLocation ? 'active' : ''}`}
  //       >
  //         {isSubscribedToCurrentLocation ? (
  //           <>
  //             <span className="icon">🔔</span>
  //             Receiving {location.name} Updates
  //           </>
  //         ) : (
  //           <>
  //             <span className="icon">🔕</span>
  //             Get 2-Hour Weather Alerts
  //           </>
  //         )}
  //       </button>
        
  //       {isSubscribedToCurrentLocation && (
  //         <div className="notification-info">
  //           <p>Next update at ~{getNextNotificationTime()}</p>
  //           <p>Location: {location.name}, {location.region}</p>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };


  const renderNotificationToggle = () => {
  if (!('Notification' in window)) return null;

  const currentLocation = `${location.name},${location.region},${location.country}`.replace(/\s*,\s*/g, ',');
  const isSubscribedToCurrentLocation = subscriptionData.isSubscribed && 
    subscriptionData.subscribedLocation === currentLocation;

  return (
    <div className="notification-controls bg-blue-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-200 dark:border-gray-600">
      <button
        onClick={isSubscribedToCurrentLocation ? unsubscribeFromNotifications : subscribeToNotifications}
        className={`notification-btn flex items-center justify-center w-full py-2 px-4 rounded-md transition-colors ${
          isSubscribedToCurrentLocation 
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
            : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
        }`}
      >
        {isSubscribedToCurrentLocation ? (
          <>
            <span className="icon mr-2">🔔</span>
            <span className="font-medium">Receiving Updates for {location.name}</span>
          </>
        ) : (
          <>
            <span className="icon mr-2">🔕</span>
            <span className="font-medium">Get 2-Hour Weather Alerts</span>
          </>
        )}
      </button>
      
      {isSubscribedToCurrentLocation && (
        <div className="notification-info mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          <p>Next update at <span className="font-medium">{getNextNotificationTime()}</span></p>
          <p>Location: <span className="font-medium">{location.name}, {location.region}</span></p>
        </div>
      )}
    </div>
  );
};

  // const renderNotificationToggle = () => {
  //   if (!('Notification' in window)) return null;

  //   // Check if we're subscribed to THIS location
  //   const currentLocation = `${location.name},${location.region},${location.country}`.replace(/\s*,\s*/g, ',');
  //   const isSubscribedToCurrentLocation = subscriptionData.isSubscribed && 
  //     subscriptionData.subscribedLocation === currentLocation;

  //   // Format next notification time nicely
  //   const formatNextNotificationTime = () => {
  //     if (!subscriptionData.isSubscribed) return '';
      
  //     try {
  //       const nextTime = getNextNotificationTime(location.tz_id);
  //       // Remove minutes from the display
  //       return nextTime.replace(/:[\d]{2}\s/, ' ');
  //     } catch (e) {
  //       return '';
  //     }
  //   };

  //   return (
  //     <div className="notification-controls bg-blue-50 dark:bg-gray-700 p-3 rounded-lg border border-blue-200 dark:border-gray-600">
  //       <button
  //         onClick={isSubscribedToCurrentLocation ? unsubscribeFromNotifications : subscribeToNotifications}
  //         className={`notification-btn flex items-center justify-center w-full py-2 px-4 rounded-md transition-colors ${
  //           isSubscribedToCurrentLocation 
  //             ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
  //             : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
  //         }`}
  //       >
  //         {isSubscribedToCurrentLocation ? (
  //           <>
  //             <span className="icon mr-2">🔔</span>
  //             <span className="font-medium">Receiving Updates for {location.name}</span>
  //           </>
  //         ) : (
  //           <>
  //             <span className="icon mr-2">🔕</span>
  //             <span className="font-medium">Get 2-Hour Weather Alerts</span>
  //           </>
  //         )}
  //       </button>
        
  //       {isSubscribedToCurrentLocation && (
  //         <div className="notification-info mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
  //           <p>Next update at <span className="font-medium">{formatNextNotificationTime()}</span></p>
  //           <p>Location: <span className="font-medium">{location.name}, {location.region}</span></p>
  //         </div>
  //       )}
  //     </div>
  //   );
  // };

  // Enhanced subscribe function
  
  const subscribeToNotifications = async () => {
    try {
      // console.group('Subscription Process');
       
      // iOS check
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // iOS requires this special permission flow
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Permission not granted');
        }
        toast.success('Notifications enabled! You will receive alerts in Safari.');
        return;
      }


      // 1. Verify service worker
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported');
      }

      const reg = await navigator.serviceWorker.ready;
      
      // 2. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // 3. Create push subscription
      const vapidPublicKey = VAPID;
      const newSubscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // 4. Normalize location
      const normalizedLocation = `${location.name},${location.region},${location.country}`.replace(/\s*,\s*/g, ',');

      // 5. Register with backend
      const response = await fetch(`${backendUrl}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: newSubscription,
          location: normalizedLocation
        })
      });

      if (!response.ok) throw new Error(`Backend error: ${response.status}`);

      // 6. Save locally
      const subJson = newSubscription.toJSON();
      localStorage.setItem('pushSubscription', JSON.stringify(subJson));
      sessionStorage.setItem('pushSubscription', JSON.stringify(subJson));
      setSubscription(newSubscription);
      setIsSubscribed(true);

      // 7. Send test notification (TESTING)
      // await fetch('http://localhost:5000/api/send-test', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message: `Test notification for ${location.name}` })
      // });

      // console.groupEnd();
      toast.success('Success! You will receive weather updates every 2 hours.');

      setSubscriptionData({
        isSubscribed: true,
        subscription: newSubscription,
        subscribedLocation: normalizedLocation
      });
    } catch (err) {
      // console.error('Subscription failed:', err);
      // console.groupEnd();
      alert(`Failed: ${err.message}`);
    }
  };

  // Enhanced unsubscribe function
  const unsubscribeFromNotifications = async () => {
    try {
      if (!subscription) return;

      const reg = await navigator.serviceWorker.ready;
      const existingSubscription = await reg.pushManager.getSubscription();
      
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Remove from backend
      await fetch(`${backendUrl}/api/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      // Clear local state
      localStorage.removeItem('pushSubscription');
      setSubscription(null);
      setIsSubscribed(false);
      toast.success('Notifications disabled successfully.');

      setSubscriptionData({
        isSubscribed: false,
        subscription: null,
        subscribedLocation: null
      });
    } catch (err) {
      // console.error('Unsubscription error:', err);
      alert(`Failed to disable: ${err.message}`);
    }
  };

  // Subscription check
  useEffect(() => {
    const checkAndRestoreSubscription = async () => {
      try {
        if (!('serviceWorker' in navigator)) return;

        // 1. Check localStorage first
        const savedSub = localStorage.getItem('pushSubscription');
        if (savedSub) {
          const parsedSub = JSON.parse(savedSub);
          
          // 2. Verify with service worker
          const reg = await navigator.serviceWorker.ready;
          const existingSubscription = await reg.pushManager.getSubscription();
          
          if (existingSubscription) {
            // 3. Verify with backend
            const response = await fetch(`${backendUrl}/api/subscribe/check`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: existingSubscription.endpoint })
            });

            if (response.ok) {
              const data = await response.json();
              setSubscriptionData({
                isSubscribed: true,
                subscription: existingSubscription,
                subscribedLocation: data.location // Assuming your backend returns the location
              });
              
              // 4. All checks passed - restore state
              setSubscription(existingSubscription);
              setIsSubscribed(true);
              // console.log('Restored existing subscription');
            } else {
              // Clean up invalid subscription
              await existingSubscription.unsubscribe();
              localStorage.removeItem('pushSubscription');
            }
          } else {
            // 5. No active SW subscription but we have local record
            // This means user revoked permissions or cleared storage
            localStorage.removeItem('pushSubscription');
          }
        }
      } catch (err) {
        // console.error('Subscription restoration error:', err);
      }
    };

    checkAndRestoreSubscription();
  }, []);

  // Update getNextNotificationTime
  // const getNextNotificationTime = (timezone) => {
  //   const now = new Date();
  //   const localHour = parseInt(now.toLocaleString('en-US', {
  //     hour: 'numeric',
  //     hour12: false,
  //     timeZone: timezone
  //   }).split(' ')[0]);
    
  //   const nextNotificationHour = localHour + (2 - (localHour % 2));
    
  //   const nextDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  //   nextDate.setHours(nextNotificationHour, 0, 0, 0);
    
  //   if (nextDate < now) {
  //     nextDate.setHours(nextDate.getHours() + 2);
  //   }
    
  //   return nextDate.toLocaleTimeString([], { 
  //     hour: '2-digit', 
  //     minute: '2-digit',
  //     hour12: true,
  //     timeZone: timezone
  //   });
  // };


  const getNextNotificationTime = () => {
    if (!subscriptionData.isSubscribed || !subscriptionData.subscribedLocation) return '';
    
    try {
      const now = new Date();
      const timezone = location.tz_id;
      
      // Get current hour in target timezone (without conversion)
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone
      });
      const localHour = parseInt(formatter.format(now));
      
      // Calculate next notification hour (current hour + 2)
      const nextNotificationHour = (localHour + 2) % 24;
      
      // Format the time directly without creating intermediate Date objects
      const nextTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
      const formattedTime = nextTime.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: true
      }).replace(/:00$/, '').replace(/:\d+ /, ' ');
      
      console.log('--- Corrected Debug ---');
      console.log('Now (UTC):', now.toISOString());
      console.log('Target Timezone:', timezone);
      console.log('Current Local Hour:', localHour);
      console.log('Next Notification Hour:', nextNotificationHour);
      console.log('Formatted Next Time:', formattedTime);
      
      return formattedTime;
    } catch (e) {
      console.error('Error calculating next notification time:', e);
      return '';
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-2xl border border-blue-200 dark:border-gray-700 rounded-2xl p-6 space-y-6 text-center max-w-3xl mx-auto transition-colors">
      {/* Current Weather */}
      <div>
        <div className="flex justify-center items-center gap-2">
          <h2 className="text-3xl font-bold text-blue-800 dark:text-blue-200">
            {location.name}, {location.region}, {location.country}
          </h2>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="p-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
            aria-label={isSaved ? "Remove from saved locations" : "Save location"}
          >
            {isSaved ? (
              <FaBookmark className="h-6 w-6" />
            ) : (
              <FaRegBookmark className="h-6 w-6" />
            )}
          </button>
        </div>

        <div className="flex justify-center mt-2 gap-2">
          <IoTime className="h-5 dark:text-gray-300" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{formattedLocalDate} {formattedLocalTime}</p>
          <span className="text-sm text-gray-500 dark:text-gray-400">({location.tz_id})</span>
        </div>
        
        <div className="flex flex-col items-center mt-4">
          <img src={weatherIcon} alt={current.condition.text} className="mx-auto w-28 h-28 drop-shadow-md"/>
          <p className="text-xl capitalize mt-2 text-gray-700 dark:text-gray-300">{current.condition.text}</p>
          <p className="text-5xl font-bold text-blue-900 dark:text-blue-100 mt-2">{current.temp_c}°C</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Feels like {current.feelslike_c}°C</p>
        </div>

        {/* Detailed Weather Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300 mt-6 text-left">
          {/* Humidity */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaTint className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Humidity</p>
              <p>{current.humidity}%</p>
            </div>
          </div>

          {/* Wind */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <img src="/icons/wind.svg" alt="Dew Point" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <div>
              <p className="font-medium">Wind</p>
              <p>{current.wind_kph} kph ({current.wind_mph} mph) {current.wind_dir}</p>
              <p className="text-xs">Gusts: {current.gust_kph} kph</p>
            </div>
          </div>

          {/* Pressure */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <img src="/icons/pressure-high.svg" alt="Pressure" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Pressure</p>
              <p>{current.pressure_mb} mb / {current.pressure_in} inHg</p>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaEye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Visibility</p>
              <p>{current.vis_km} km / {current.vis_miles} miles</p>
            </div>
          </div>

          {/* UV Index */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <img src="/icons/uv-index.svg" alt="UV Index" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">UV Index</p>
              <p>{current.uv} ({getUvIndexLevel(current.uv)})</p>
            </div>
          </div>

          {/* Cloud Cover */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaCloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Cloud Cover</p>
              <p>{current.cloud}%</p>
            </div>
          </div>

          {/* Dew Point */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <img src="/icons/thermometer-glass.svg" alt="Dew Point" className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Dew Point</p>
              <p>{current.dewpoint_c}°C / {current.dewpoint_f}°F</p>
            </div>
          </div>

          {/* Precipitation */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaUmbrella className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Precipitation</p>
              <p>{current.precip_mm} mm / {current.precip_in} in</p>
            </div>
          </div>

          {/* Heat Index */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaTemperatureHigh className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Heat Index</p>
              <p>{current.heatindex_c}°C / {current.heatindex_f}°F</p>
            </div>
          </div>

          {/* Wind Chill */}
          <div className="flex items-center space-x-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
            <FaTemperatureLow className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium">Wind Chill</p>
              <p>{current.windchill_c}°C / {current.windchill_f}°F</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="weather-card text-gray-700 dark:text-gray-300">
        {renderNotificationToggle()}
      </div>

      {/* Hourly Forecast */}
      {todayHourlyForecast.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 p-2 font-medium text-blue-600 dark:text-blue-400">
            <IoTime className="h-5" />
            Today's Hourly Forecast
          </div>

          <div className="mt-2 overflow-x-auto forecast-scroll">
            <div className="flex space-x-4 pb-2">
              {todayHourlyForecast.map((hourData, index) => {
                const hourDate = new Date(hourData.time);
                const hour = hourDate.getHours();
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                const displayTime = `${hour12}${ampm}`;
                
                // Get current time in the searched location
                const currentLocationTime = new Date(location.localtime);
                const currentHour = currentLocationTime.getHours();
                const isCurrentHour = currentHour === hour;
                const hourIcon = getSvgForWeather(hourData.condition.code, hourData.is_day);

                return (
                  <div key={index} className={`flex flex-col items-center p-3 rounded-lg min-w-[80px] ${ isCurrentHour ? 'bg-blue-100/50 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700' : 'bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'}`}>
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{displayTime}</span>
                    <img src={hourIcon} alt={hourData.condition.text} className="w-10 h-10 my-1" />
                    <span className="font-bold text-gray-700 dark:text-gray-300">{hourData.temp_c}°</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 ">
                      {hourData.chance_of_rain}% {hourData.chance_of_rain > 0 && '🌧️'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {hourData.wind_kph} kph
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}    

      {/* Astronomical Data */}
      <div className="mt-4 border border-gray-200 dark:border-gray-600 bg-blue-50/80 dark:bg-gray-700/80 rounded-lg transition-colors">
        <button onClick={() => setShowAstro(!showAstro)} className="flex items-center justify-between w-full p-2 font-medium text-left text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200">
          <span className="flex items-center gap-2">
            <WiSunrise className="h-7 w-7" />
            Sun & Moon Times
          </span>
          <span className="transition-transform duration-300">
            {showAstro ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
          </span>
        </button>

        <div className={`text-gray-700 dark:text-gray-300 overflow-hidden transition-all duration-500 ease-in-out ${showAstro ? 'max-h-96' : 'max-h-0'}`}>
          <div className="p-4 flex flex-wrap justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img src="/icons/sunrise.svg" alt="Sunrise" className="w-8 h-8" />
              <div>
                <p className="font-medium text-start text-sm">Sunrise</p>
                <p className="">{todayAstro.sunrise}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <img src="/icons/sunset.svg" alt="Sunset" className="h-8 w-8" />
              <div>
                <p className="font-medium text-start text-sm">Sunset</p>
                <p className="">{todayAstro.sunset}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <img src="/icons/moonrise.svg" alt="Moonrise" className="h-8 w-8" />
              <div>
                <p className="font-medium text-start text-sm">Moonrise</p>
                <p className="">{todayAstro.moonrise}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <img src="/icons/moonset.svg" alt="Moonset" className="h-8 w-8" />
              <div>
                <p className="font-medium text-start text-sm">Moonset</p>
                <p className="">{todayAstro.moonset}</p>
              </div>
            </div>

            <div className="col-span-2 flex items-center space-x-3">
              <div className="h-8 w-8 flex items-center justify-center">
                {moonIconSrc && (
                  <img src={moonIconSrc} alt={todayAstro.moon_phase} className="w-8 h-8" />
                )}
              </div>
              <div>
                <p className="font-medium text-start text-sm">Moon Phase</p>
                <p className="text-start flex items-center gap-2">
                  {todayAstro.moon_phase} ({todayAstro.moon_illumination}% illuminated)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Air Quality */}
      {aqi && (
        <div className="text-gray-700 dark:text-gray-300 text-left mt-4 border border-gray-200 dark:border-gray-600 bg-blue-50/80 dark:bg-gray-700/80 rounded-lg transition-colors">
          <div id="aqi-accordion">
            <h2 id="aqi-accordion-heading">
              <button type="button" className="border-gray-200 dark:border-gray-600 flex items-center justify-between w-full p-2 font-medium text-left text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200" onClick={() => setShowAQI(!showAQI)} aria-expanded={showAQI} aria-controls="aqi-accordion-body">
                <span className="flex items-center gap-2">
                  <img src="/icons/wind-beaufort-0.svg" alt="" className="h-7 w-7" />
                  Air Quality Details
                </span>
                <span className="transition-transform duration-300">
                  {showAstro ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                </span>
              </button>
            </h2>
            <div id="aqi-accordion-body" className={`overflow-hidden transition-all duration-500 ease-in-out ${showAQI ? 'max-h-96' : 'max-h-0'}`} aria-labelledby="aqi-accordion-heading">
              <div className="p-4">
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🔵 Carbon Monoxide (CO)</span>
                    </div>
                    <span className="font-mono">{aqi.co.toFixed(2)} μg/m³</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🟠 Nitrogen Dioxide (NO₂)</span>
                    </div>
                    <span className="font-mono">{aqi.no2.toFixed(2)} μg/m³</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🟡 Ozone (O₃)</span>
                    </div>
                    <span className="font-mono">{aqi.o3.toFixed(2)} μg/m³</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🔴 PM2.5</span>
                    </div>
                    <span className="font-mono">{aqi.pm2_5.toFixed(2)} μg/m³</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🟤 PM10</span>
                    </div>
                    <span className="font-mono">{aqi.pm10.toFixed(2)} μg/m³</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <span>🟣 Sulfur Dioxide (SO₂)</span>
                    </div>
                    <span className="font-mono">{aqi.so2.toFixed(2)} μg/m³</span>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span>US EPA Index:</span>
                      <span className={`font-medium ${epaIndexMap[aqi['us-epa-index']]?.color || ''}`}>
                        {epaIndexMap[aqi['us-epa-index']]?.label || 'N/A'} ({aqi['us-epa-index']})
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span>UK DEFRA Index:</span>
                      <span className={`font-medium ${defraIndexMap[aqi['gb-defra-index']]?.color || ''}`}>
                        {defraIndexMap[aqi['gb-defra-index']]?.label || 'N/A'} ({aqi['gb-defra-index']})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weather Alerts */}
      {hasAlerts && (
        <div className="text-gray-700 dark:text-gray-300 mt-4 border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20 rounded-lg transition-colors">
          <button onClick={() => setShowAlerts(!showAlerts)} className="flex items-center justify-between w-full p-2 font-medium text-left text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors">
            <span className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              Weather Alerts
            </span>
            {showAlerts ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          
          {showAlerts && (
            <div className="p-4">
              {alerts.alert.map((alert, index) => (
                <div key={index} className="mb-4 last:mb-0">
                  <h4 className="font-bold text-red-700 dark:text-red-300">{alert.headline}</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{alert.desc}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Effective: {new Date(alert.effective).toLocaleString()} - 
                    Expires: {new Date(alert.expires).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3-Day Forecast */}
      {forecast?.forecastday && (
        <div className="mt-6 text-gray-700 dark:text-gray-300">
          <div className="flex justify-center mt-2 gap-2">
            <SlCalender className="h-7 text-black dark:text-gray-300" />
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4"> 3-Day Forecast</h3>
          </div>

          {/* Desktop Grid View */}
          <div className="hidden md:grid grid-cols-3 gap-4 h-[260px]">
            {forecast.forecastday.map((day) => (
              <ForecastDayCard key={day.date} day={day} />
            ))}
          </div>

          {/* Mobile Slider View */}
          <div className="md:hidden">
            <Slider {...sliderSettings}>
              {forecast.forecastday.map((day) => (
                <div key={day.date} className="px-1 h-[260px]">
                  <ForecastDayCard day={day} />
                </div>
              ))}
            </Slider>
          </div>
        </div>
      )}
    </div>
  );
};

const ForecastDayCard = ({ day }) => {
  const [flipped, setFlipped] = useState(false);
  const forecastIcon = getSvgForWeather(day.day.condition.code, 1); // replace with your icon function

  return (
    <div className="flip-card h-full w-full" onClick={() => setFlipped(!flipped)}>
      <div className={`flip-card-inner h-full ${flipped ? 'flipped' : ''}`}>
        
        {/* FRONT */}
        <div className="flip-card-front h-full bg-white/90 dark:bg-gray-700/90 border border-blue-200 dark:border-gray-600 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <p className="font-medium text-blue-700 dark:text-blue-300">
              {new Date(day.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          <img
            src={forecastIcon}
            alt={day.day.condition.text}
            className="w-16 h-16 mx-auto my-2"
          />
          <p className="capitalize text-gray-700 dark:text-gray-300 text-sm text-center">
            {day.day.condition.text}
          </p>

          <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                {day.day.avgtemp_c}°C
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Temp</p>
            </div>
            <div className="text-center">
              <p className="text-lg text-blue-600 dark:text-blue-400">
                {day.day.avghumidity}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Humidity</p>
            </div>
            <div className="text-center">
              <p className="text-blue-600 dark:text-blue-400">↑ {day.day.maxtemp_c}°C</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">High</p>
            </div>
            <div className="text-center">
              <p className="text-blue-600 dark:text-blue-400">↓ {day.day.mintemp_c}°C</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Low</p>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="flip-card-back h-full bg-white/90 dark:bg-gray-700/90 border border-blue-200 dark:border-gray-600 rounded-lg p-4 text-xs overflow-auto">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-gray-500 dark:text-gray-400">Max Wind</p><p>{day.day.maxwind_kph} kph</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Precip</p><p>{day.day.totalprecip_mm} mm</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Rain Chance</p><p>{day.day.daily_chance_of_rain}%</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">UV Index</p><p>{day.day.uv}</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Visibility</p><p>{day.day.avgvis_km} km</p></div>
          </div>

          <div className="mt-3">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Air Quality</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>CO: {day.day.air_quality?.co?.toFixed(2) || 'N/A'}</span>
              <span>NO₂: {day.day.air_quality?.no2?.toFixed(2) || 'N/A'}</span>
              <span>O₃: {day.day.air_quality?.o3?.toFixed(2) || 'N/A'}</span>
              <span>SO₂: {day.day.air_quality?.so2?.toFixed(2) || 'N/A'}</span>
              <span>PM2.5: {day.day.air_quality?.pm2_5?.toFixed(2) || 'N/A'}</span>
              <span>PM10: {day.day.air_quality?.pm10?.toFixed(2) || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get UV index level
function getUvIndexLevel(uvIndex) {
  if (uvIndex >= 0 && uvIndex <= 2) return 'Low';
  if (uvIndex >= 3 && uvIndex <= 5) return 'Moderate';
  if (uvIndex >= 6 && uvIndex <= 7) return 'High';
  if (uvIndex >= 8 && uvIndex <= 10) return 'Very High';
  if (uvIndex >= 11) return 'Extreme';
  return 'N/A';
}

export default WeatherCard;