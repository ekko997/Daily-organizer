import { createContext, useContext } from 'react';
import { CloudEvent, EventScope } from '../services/cloudEventService';

interface EventsContextValue {
  events: CloudEvent[];
  activeScope: EventScope;
  setActiveScope: (scope: EventScope) => void;
  countryCode: string;
  setCountryCode: (code: string) => void;
  region: string;
  setRegion: (region: string) => void;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  setLocation: (cityName: string, latitude: number, longitude: number) => void;
  restrictToOwnEvents: boolean;
  setRestrictToOwnEvents: (value: boolean) => void;
}

export const EventsContext = createContext<EventsContextValue>({
  events: [],
  activeScope: 'personal',
  setActiveScope: () => {},
  countryCode: 'US',
  setCountryCode: () => {},
  region: '',
  setRegion: () => {},
  cityName: '',
  latitude: null,
  longitude: null,
  setLocation: () => {},
  restrictToOwnEvents: false,
  setRestrictToOwnEvents: () => {},
});

export function useEvents() {
  return useContext(EventsContext);
}
