// Every text the explorer shows (spec model3d/building-viewer, "The interface
// is in English, with all texts in one place"). A second language adds an
// object with the same keys (model3d-german-translation).

import type { Co2Status } from '../core/status';

export const strings = {
  title: 'LeoIoT 3D',
  loading: 'Loading the building…',
  loadingProgress: (done: number, total: number, mb: number) => `${done} of ${total} models · ${mb.toFixed(0)} MB`,
  loadError: 'The building model could not be loaded.',
  loadErrorDetail: (failed: number, total: number) => `${failed} of ${total} models failed to load.`,
  tryAgain: 'Try again',
  views: {
    U: 'Basement',
    E: 'Ground floor',
    '1': 'Floor 1',
    '2': 'Floor 2',
    T: 'Gym',
    reset: 'Reset View',
  },
  heatmap: {
    temperature: 'Temperature',
    co2: 'CO2',
    noData: 'No data',
  },
  panel: {
    close: 'Close',
    co2: 'CO₂',
    temperature: 'Temperature',
    unknown: '–',
    noData: 'No data for room',
    outdated: 'Outdated: no new reading for more than 5 minutes',
    // Temporary (spec "The info panel shows the time of the last reading, for now")
    lastReading: 'Last reading',
  },
  status: {
    green: 'Good',
    yellow: 'Elevated',
    red: 'High',
  } satisfies Record<Co2Status, string>,
};
