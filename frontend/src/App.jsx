import { useEffect, useState } from 'react';
import axios from 'axios';
import MapComponent from './components/MapComponent';
import WeatherCard from './components/WeatherCard';
import { FaSearch, FaMoon, FaSun } from 'react-icons/fa';
import { MdOutlineLocationOff, MdOutlineLocationOn } from "react-icons/md";
import { ImCross } from "react-icons/im";
import { WeatherCardSkeleton, MapSkeleton, SavedSkeleton } from './components/Skeleton';
import toast, { Toaster } from 'react-hot-toast';

let debounceTimer;

function App() {
  const [suggestions, setSuggestions] = useState([]);
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [locationDenied, setLocationDenied] = useState(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const backendUrl = import.meta.env.VITE_API_URL;

  // Ensure this runs on every page load
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // Check for existing subscription
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Verify with backend
          const response = await fetch(`${backendUrl}/api/subscribe/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          });
          
          if (!response.ok) {
            await subscription.unsubscribe();
          }
        }
      } catch (err) {
        // console.error('Service Worker registration failed:', err);
      }
    });
  }

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    // Save preference to localStorage
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));

    // Apply the className directly
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const savedPreference = localStorage.getItem('darkMode');
    if (savedPreference !== null) {
      return JSON.parse(savedPreference);
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply the initial dark mode className
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const fetchSuggestions = async (value) => {
    if (!value) return setSuggestions([]);
    try {
      const res = await axios.get(`${backendUrl}/api/weather/search/${value}`);
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setCity(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(value), 500);
  };

  const handleSuggestionClick = async (location) => {
    const { name, region, country } = location;
    setCity(`${name}, ${region ? region + ', ' : ''}${country}`);
    setSuggestions([]);
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/weather/city`, { params: { name, region, country } });
      setWeather(res.data);
      setCoords({ lat: res.data.location.lat, lon: res.data.location.lon });
    } catch {
      toast.error("Failed to fetch weather for selected city.");
    } finally {
      setLoading(false);
    }
  };

  const fetchByCity = async () => {
    if (!city) return;
    setLoading(true);
    try {
      const res = await axios.get(`${backendUrl}/api/weather/city/${city}`);
      setWeather(res.data);
      setCoords({ lat: res.data.location.lat, lon: res.data.location.lon });
    } catch {
      toast.error("City not found");
    } finally {
      setLoading(false);
    }
  };

  const fetchByLocation = () => {
    setLoading(true);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const getPosition = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const res = await axios.get(
              `${backendUrl}/api/weather/coords?lat=${latitude}&lon=${longitude}`
            );
            setWeather(res.data);
            setCoords({ lat: latitude, lon: longitude });
            setLocationDenied(false);
          } catch {
            toast.error("Failed to fetch weather by coordinates");
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          setLoading(false);
          if (err.code === 1) setLocationDenied(true);
          toast.error("Location error: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    if (isIOS) {
      // Special handling for iOS
      const iosLocationCheck = async () => {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          if (permission.state === 'granted') {
            getPosition();
          } else {
            // Show iOS-specific instructions
            toast(
              <div className="text-left">
                <p className="font-bold">iOS Location Help:</p>
                <ol className="list-decimal pl-5">
                  <li>Open <b>Settings</b> app</li>
                  <li>Scroll to <b>Safari</b></li>
                  <li>Tap <b>Location</b></li>
                  <li>Select <b>"Allow"</b></li>
                  <li>Refresh this page</li>
                </ol>
              </div>,
              { duration: 10000, icon: '📍' }
            );
          }
        } catch (err) {
          getPosition(); // Fallback to regular method
        }
      };
      iosLocationCheck();
    } else {
      getPosition();
    }
  };

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          fetchByLocation();
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            fetchByLocation();
          } else if (result.state === 'denied') {
            setLocationDenied(true);
            setPermanentlyDenied(true);
          }
        };
      });
    }
  }, []);

  const handleRequestLocation = () => {
    setLocationDenied(false);
    fetchByLocation();
  };

  const [savedLocations, setSavedLocations] = useState(() => {
    const saved = localStorage.getItem('savedLocations');
    return saved ? JSON.parse(saved) : [];
  });

  const saveCurrentLocation = () => {
    if (!weather) return;
    
    // Check if already saved
    const isAlreadySaved = savedLocations.some(
      loc => loc.lat === weather.location.lat && loc.lon === weather.location.lon
    );
    
    if (isAlreadySaved) {
      toast('This location is already saved', {
        icon: 'ℹ️',
      });
      return;
    }
    
    const newLocation = {
      name: weather.location.name,
      region: weather.location.region,
      country: weather.location.country,
      lat: weather.location.lat,
      lon: weather.location.lon,
      timestamp: new Date().toISOString()
    };
    
    const updatedLocations = [...savedLocations, newLocation];
    setSavedLocations(updatedLocations);
    localStorage.setItem('savedLocations', JSON.stringify(updatedLocations));
    toast.success(`Location ${newLocation.name} saved successfully!`);
  };

  const removeSavedLocation = (index) => {
    const locationName = savedLocations[index].name;
    const updatedLocations = [...savedLocations];
    updatedLocations.splice(index, 1);
    setSavedLocations(updatedLocations);
    localStorage.setItem('savedLocations', JSON.stringify(updatedLocations));
    toast.success(`Removed ${locationName} successfully!`);
  };

  const loadSavedLocation = async (location) => {
    setLoading(true);
    setCity(`${location.name}, ${location.region ? location.region + ', ' : ''}${location.country}`);
    try {
      const res = await axios.get(`${backendUrl}/api/weather/coords?lat=${location.lat}&lon=${location.lon}`);
      setWeather(res.data);
      setCoords({ lat: location.lat, lon: location.lon });
    } catch {
      toast.alert("Failed to fetch weather for saved location.");
    } finally {
      setLoading(false);
    }
  };

  // Request notification permission + register SW
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          // console.log("SW registered:", registration);

          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            // console.log("Push notifications allowed!");
          }
        } catch (err) {
          // console.error("SW registration failed:", err);
        }
      };
      registerSW();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 dark:from-gray-800 dark:to-gray-900 p-6 transition-colors duration-300">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with theme toggle */}
        <div className="flex justify-between items-center">
          <div className='flex justify-center gap-5 m-4'>
            <img src="/logo.png" alt="Logo" className='h-10 w-10 dark:invert' />
            <h1 className="text-4xl font-bold text-center text-blue-800 dark:text-blue-200 drop-shadow-lg">Weatherly</h1>
          </div>

          <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/80 dark:bg-gray-700/80 shadow-md hover:bg-white dark:hover:bg-gray-600 transition-colors" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-gray-700" />}
          </button>
        </div>

        {/* City Search Input */}
        <div className="max-w-lg flex mx-auto">
          <div className="relative w-full max-w-lg">
            <input
              type="text"
              placeholder="Enter city"
              value={city}
              onChange={handleInputChange}
              className="w-full px-4 py-2 pr-12 rounded-lg border border-blue-400 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 shadow dark:bg-gray-700 dark:text-white transition-colors"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 bg-white dark:bg-gray-700 w-full shadow-md rounded mt-1 max-h-60 overflow-y-auto">
                {suggestions.map((loc) => (
                  <li
                    key={`${loc.name}-${loc.country}-${loc.region}`}
                    onClick={() => handleSuggestionClick(loc)}
                    className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer dark:text-white"
                  >
                    {loc.name}, {loc.region ? `${loc.region}, ` : ""}{loc.country}
                  </li>
                ))}
              </ul>
            )}
            <span
              className="absolute inset-y-0 right-4 flex items-center justify-center text-blue-400 dark:text-blue-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
              onClick={fetchByCity}
            >
              <FaSearch className="h-5 w-5" />
            </span>
          </div>
        </div>

        {/* Location prompt button */}
        {!locationDenied && !weather && !loading && (
          <div className="text-center">
            <button
              onClick={handleRequestLocation}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 mx-auto transition-colors"
            >
              <MdOutlineLocationOn className="h-5 w-5" />
              Get My Location Weather
            </button>
          </div>
        )}

        {locationDenied && (
          <div className="text-center bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm p-4 rounded-lg shadow-md mx-auto max-w-md mt-4 border border-red-200 dark:border-red-800 transition-colors">
            <div className="flex items-center justify-center mb-2">
              <MdOutlineLocationOff className='text-red-600 dark:text-red-400 h-10 w-10' />
              <p className="text-red-600 dark:text-red-400 font-semibold">
                Location access is turned off. You can still search for weather by city name.
              </p>
            </div>

            <div className="flex justify-center gap-3 mt-3">
              <button
                onClick={handleRequestLocation}
                className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-1 rounded-md text-sm transition-colors flex items-center gap-1"
              >
                <MdOutlineLocationOn />
                Try Again
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              You've permanently denied location access. Please allow it from your{" "}
              <button
                onClick={() => alert("Click the 🔒 icon near the address bar → Site Settings → Location → Allow → Reload the page.")}
                className="text-blue-500 dark:text-blue-400 hover:underline"
              >
                browser settings
              </button>
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && ( 
          <div className="space-y-6">
            <WeatherCardSkeleton />
            <MapSkeleton />
            <SavedSkeleton />
          </div>
        )} 

        {/* Weather + Map */}
        {weather && !loading && (
          <div className="space-y-6">
            {/* <WeatherCard weather={weather} /> */}
            <WeatherCard 
              weather={weather} 
              onSave={saveCurrentLocation}
              isSaved={savedLocations.some(loc => 
                loc.lat === weather.location.lat && 
                loc.lon === weather.location.lon
              )}
            />
            {coords.lat && coords.lon && (
              <div className="rounded-lg overflow-hidden shadow-lg border border-blue-300 dark:border-gray-700 transition-colors">
                <MapComponent lat={coords.lat} lon={coords.lon} darkMode={darkMode} />
              </div>
            )}
          </div>
        )}
        
        {/* Saved Locations Section */}
        <div className="mt-8 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200">Saved Locations</h2>
            {weather && (
              <button  onClick={saveCurrentLocation} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors">
                Save Current
              </button>
            )}
          </div>

          {savedLocations.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No saved locations yet. Search for a location and click "Save Current" to add it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {savedLocations.map((location, index) => (
                <li key={`${location.name}-${index}`} className="flex justify-between items-center p-2 hover:bg-blue-50 dark:hover:bg-gray-600 rounded-md transition-colors">
                  <div className="cursor-pointer flex-grow" onClick={() => loadSavedLocation(location)}>
                    <p className="font-medium dark:text-white">{location.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {location.region && `${location.region}, `}{location.country}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-400">
                      Saved on {new Date(location.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSavedLocation(index);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                    aria-label="Remove location"
                  >
                    <ImCross/>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Toaster/>

        <footer className="bg-white rounded-lg shadow-sm dark:bg-gray-900">
          <div className="w-full max-w-screen-xl mx-auto p-4 md:py-6">
            <div className="sm:flex sm:items-center sm:justify-between mb-2">
              <div>
                <a href="https://flowbite.com/" className="flex items-center mb-4 sm:mb-0 space-x-3 rtl:space-x-reverse">
                  <img src="/logo.png" alt="Weatherly Logo" className='h-10 w-10 dark:invert' />
                  <h1 className="text-4xl font-bold text-center text-blue-800 dark:text-blue-200 drop-shadow-lg">Weatherly</h1>
                </a>
                <h1 className='sm:w-72 mt-2 mb-2 dark:text-gray-400'>Accurate weather updates powered by trusted meteorological sources.</h1>
              </div>
              <ul className="flex flex-wrap items-center mb-6 text-sm font-medium text-gray-500 sm:mb-0 dark:text-gray-400">
                <li>
                  <a href="#" className="hover:underline me-4 md:me-6">About</a>
                </li>
                <li>
                  <a href="#" className="hover:underline me-4 md:me-6">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="hover:underline me-4 md:me-6">Licensing</a>
                </li>
                <li>
                  <a href="#" className="hover:underline">Contact</a>
                </li>
              </ul>
              <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/80 dark:bg-gray-700/80 shadow-md hover:bg-white dark:hover:bg-gray-600 transition-colors" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
                {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon className="text-gray-700" />}
              </button>
            </div>
            <hr className="my-6 border-gray-200 sm:mx-auto dark:border-gray-700" />
            <span className="block text-sm text-gray-500 sm:text-center dark:text-gray-400">© 2025 <a href="https://flowbite.com/" className="hover:underline">Weatherly</a>. All Rights Reserved.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;