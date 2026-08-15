import { createContext, useContext } from 'react';
import { OrganizerEvent } from '../models/Event';

interface EventsContextValue {
  events: OrganizerEvent[];
  refreshEvents: () => Promise<void>;
  countryCode: string;
  setCountryCode: (code: string) => void;
  region: string;
  setRegion: (region: string) => void;
}

export const EventsContext = createContext<EventsContextValue>({
  events: [],
  refreshEvents: async () => {},
  countryCode: 'US',
  setCountryCode: () => {},
  region: '',
  setRegion: () => {},
});

export function useEvents() {
  return useContext(EventsContext);
}
