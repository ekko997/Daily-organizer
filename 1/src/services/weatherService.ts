import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CitySearchResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface DailyForecast {
  date: string; // yyyy-MM-dd
  tempMaxC: number;
  tempMinC: number;
  weatherCode: number;
  sunrise?: string;
  sunset?: string;
}

/** Looks up a city name and returns candidate matches with coordinates. */
export async function searchCity(query: string): Promise<CitySearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } catch {
    return [];
  }
}

const CACHE_KEY_PREFIX = 'weather_forecast_';

/** Loads a 16-day daily forecast for the given coordinates, caching for offline use. */
export async function loadForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`;
  let forecast: DailyForecast[] = [];

  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try { forecast = JSON.parse(cached); } catch { /* ignore */ }
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&forecast_days=16&timezone=auto`
    );
    if (res.ok) {
      const data = await res.json();
      const days: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
        date,
        tempMaxC: data.daily.temperature_2m_max[i],
        tempMinC: data.daily.temperature_2m_min[i],
        weatherCode: data.daily.weathercode[i],
        sunrise: data.daily.sunrise?.[i],
        sunset: data.daily.sunset?.[i],
      }));
      await AsyncStorage.setItem(cacheKey, JSON.stringify(days));
      forecast = days;
    }
  } catch {
    // offline or request failed — fall back to whatever cache we already loaded
  }

  return forecast;
}

/** Maps Open-Meteo's WMO weather codes to an Ionicons name. */
export function weatherIcon(code: number): string {
  if (code === 0) return 'sunny';
  if ([1, 2, 3].includes(code)) return 'partly-sunny';
  if ([45, 48].includes(code)) return 'cloudy';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'partly-sunny';
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Cloudy';
}
