import { createContext, useContext } from 'react';
import { OrganizerEvent } from '../models/Event';

interface EventsContextValue {
  events: OrganizerEvent[];
  refreshEvents: () => Promise<void>;
  countryCode: string;
  setCountryCode: (code: string) => void;
  region: string;
  setRegion: (region: string) => void;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  setLocation: (cityName: string, latitude: number, longitude: number) => void;
}

export const EventsContext = createContext<EventsContextValue>({
  events: [],
  refreshEvents: async () => {},
  countryCode: 'US',
  setCountryCode: () => {},
  region: '',
  setRegion: () => {},
  cityName: '',
  latitude: null,
  longitude: null,
  setLocation: () => {},
});

export function useEvents() {
  return useContext(EventsContext);
}
