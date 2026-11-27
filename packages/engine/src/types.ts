export type TravelMode = "walk" | "bike" | "bus" | "train" | "ship" | "plane";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Leg {
  from: LatLng;
  to: LatLng;
  mode: TravelMode;
  /** Optional road polyline (cached Routes API result). Falls back to great-circle. */
  path?: LatLng[];
  /** Fixed travel distance in meters (e.g. road distance). Overrides path/great-circle length. */
  distanceM?: number;
}

export interface Journey {
  /** Epoch ms when the journey started. */
  startedAt: number;
  /** 1 = real time. */
  timeScale: number;
  legs: Leg[];
}

export interface Position extends LatLng {
  legIndex: number;
  /** 0..1 progress within the current leg. */
  legProgress: number;
  finished: boolean;
}
