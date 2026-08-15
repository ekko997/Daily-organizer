import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PublicHoliday {
  date: string;        // "yyyy-MM-dd"
  localName: string;
  name: string;
  countryCode: string;
  counties: string[] | null; // region codes this applies to; null = whole country
  global: boolean;
}

const cacheKey = (countryCode: string, year: number) => `holidays_${countryCode}_${year}`;

/**
 * Fetches public holidays for a country/year from the free Nager.Date API
 * (no key required) and caches the result so the calendar works offline
 * after the first sync. Optionally filters to a specific region/state code.
 */
export async function loadHolidays(
  countryCode: string,
  year: number,
  region?: string
): Promise<Map<string, PublicHoliday>> {
  const map = new Map<string, PublicHoliday>();

  // 1. Try cache first so the UI has something immediately.
  const cached = await AsyncStorage.getItem(cacheKey(countryCode, year));
  if (cached) {
    applyHolidays(JSON.parse(cached), region, map);
  }

  // 2. Refresh from network.
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (response.ok) {
      const holidays: PublicHoliday[] = await response.json();
      await AsyncStorage.setItem(cacheKey(countryCode, year), JSON.stringify(holidays));
      applyHolidays(holidays, region, map);
    }
  } catch {
    // Offline or request failed — fall back to whatever cache we already applied.
  }

  return map;
}

function applyHolidays(holidays: PublicHoliday[], region: string | undefined, map: Map<string, PublicHoliday>) {
  for (const holiday of holidays) {
    if (holiday.counties && region && !holiday.counties.includes(region)) continue;
    map.set(holiday.date, holiday);
  }
}

export const SUPPORTED_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PT', name: 'Portugal' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NZ', name: 'New Zealand' },
];
