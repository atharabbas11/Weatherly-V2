// // utils/getWeatherSvgIcon.js

// // A simplified mapping for example. Expand this as needed.
// const codeToBaseIcon = {
//   1000: "clear", // Sunny/Clear
//   1003: "partly-cloudy",
//   1006: "cloudy",
//   1009: "overcast",
//   1030: "fog",
//   1063: "rain", // Patchy rain
//   1087: "thunder", // Thunderstorms
//   1114: "snow",
//   1135: "fog",
//   1150: "drizzle",
//   1183: "rain",
//   1195: "rain",
//   1210: "snow",
//   1240: "rain",
//   1276: "thunder",
//   1279: "snow",
//   // Add more mappings from your JSON
// };

// export function getSvgForWeather(code, isDay = 1) {
//   const base = codeToBaseIcon[code] || "unknown";
//   const time = isDay ? "day" : "night";

//   return `/icons/${time}-${base}.svg`;
// }

// utils/getWeatherSvgIcon.js

const codeToIconMap = {
  // Clear/Sunny
  1000: {
    day: 'clear-day',
    night: 'clear-night'
  },
  // Partly cloudy
  1003: {
    day: 'partly-cloudy-day',
    night: 'partly-cloudy-night'
  },
  // Cloudy
  1006: 'cloudy',
  // Overcast
  1009: 'overcast',
  // Mist
  1030: 'mist',
  // Patchy rain possible
  1063: {
    day: 'partly-cloudy-day-rain',
    night: 'partly-cloudy-night-rain'
  },
  // Patchy snow possible
  1066: {
    day: 'partly-cloudy-day-snow',
    night: 'partly-cloudy-night-snow'
  },
  // Patchy sleet possible
  1069: {
    day: 'partly-cloudy-day-sleet',
    night: 'partly-cloudy-night-sleet'
  },
  // Patchy freezing drizzle possible
  1072: 'drizzle',
  // Thundery outbreaks possible
  1087: {
    day: 'thunderstorms-day',
    night: 'thunderstorms-night'
  },
  // Blowing snow
  1114: 'snow',
  // Blizzard
  1117: 'snow',
  // Fog
  1135: 'fog',
  // Freezing fog
  1147: 'fog',
  // Patchy light drizzle
  1150: 'drizzle',
  // Light drizzle
  1153: 'drizzle',
  // Freezing drizzle
  1168: 'drizzle',
  // Heavy freezing drizzle
  1171: 'drizzle',
  // Patchy light rain
  1180: 'rain',
  // Light rain
  1183: 'rain',
  // Moderate rain at times
  1186: 'rain',
  // Moderate rain
  1189: 'rain',
  // Heavy rain at times
  1192: 'rain',
  // Heavy rain
  1195: 'rain',
  // Light freezing rain
  1198: 'rain',
  // Moderate or heavy freezing rain
  1201: 'rain',
  // Light sleet
  1204: 'sleet',
  // Moderate or heavy sleet
  1207: 'sleet',
  // Patchy light snow
  1210: 'snow',
  // Light snow
  1213: 'snow',
  // Patchy moderate snow
  1216: 'snow',
  // Moderate snow
  1219: 'snow',
  // Patchy heavy snow
  1222: 'snow',
  // Heavy snow
  1225: 'snow',
  // Ice pellets
  1237: 'hail',
  // Light rain shower
  1240: 'rain',
  // Moderate or heavy rain shower
  1243: 'rain',
  // Torrential rain shower
  1246: 'rain',
  // Light sleet showers
  1249: 'sleet',
  // Moderate or heavy sleet showers
  1252: 'sleet',
  // Light snow showers
  1255: 'snow',
  // Moderate or heavy snow showers
  1258: 'snow',
  // Light showers of ice pellets
  1261: 'hail',
  // Moderate or heavy showers of ice pellets
  1264: 'hail',
  // Patchy light rain with thunder
  1273: {
    day: 'thunderstorms-day-rain',
    night: 'thunderstorms-night-rain'
  },
  // Moderate or heavy rain with thunder
  1276: {
    day: 'thunderstorms-day-rain',
    night: 'thunderstorms-night-rain'
  },
  // Patchy light snow with thunder
  1279: {
    day: 'thunderstorms-day-snow',
    night: 'thunderstorms-night-snow'
  },
  // Moderate or heavy snow with thunder
  1282: {
    day: 'thunderstorms-day-snow',
    night: 'thunderstorms-night-snow'
  }
};

export function getSvgForWeather(code, isDay = true) {
  const iconMapping = codeToIconMap[code];
  
  if (!iconMapping) {
    return '/icons/not-available.svg';
  }

  let iconName;
  
  if (typeof iconMapping === 'object') {
    iconName = isDay ? iconMapping.day : iconMapping.night;
  } else {
    iconName = iconMapping;
  }

  return `/icons/${iconName}.svg`;
}