// TEMPORARY: see README.md. Generates room-climate readings; deliberately synthetic.

// The rooms of the building model (a test checks them against the model files)
export const ROOMS = [
  'U04', 'U05', 'U07', 'U08', 'U10', 'U71', 'U72', 'U73', 'U74', 'U74.1', 'U77', 'U78', 'U79',
  'U81', 'U82', 'U83', 'U84', 'U85', 'U86', 'U87', 'U88', 'U89', 'U90', 'U91', 'U92', 'UBiolab',
  'E05', 'E07', 'E08', 'E09', 'E10', 'E11', 'E22', 'E23', 'E24', 'E25', 'E26', 'E581', 'E582', 'E59', 'E71', 'E72', 'E73',
  '103', '104', '105', '106', '107', '108', '109', '119', '121', '122', '123', '124',
  '130', '131', '132', '133', '134', '142', '143', '144', '145', '146', '147', '148',
  '151', '152', '153', '154', '1Aula',
  '203', '204', '206', '213', '214', '215', '216', '217', '218',
  '226', '227', '228', '229', '230', '231', '237', '239', '241', '251', '252', '253', '254',
  'T1', 'T2', 'T3', 'T4', 'T6', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T19',
];

export const DEVICE = 'temporary-simulator';
const PERIOD_MS = 40 * 60_000;

function phase(room, ts) {
  const index = ROOMS.indexOf(room);
  // Spread the rooms over the whole wave, whatever their order
  return Math.sin((2 * Math.PI * ts) / PERIOD_MS + index * 2.399963);
}

/** The message of one room at time ts, in the shape of platform/data-contract. */
export function reading(room, ts) {
  const wave = phase(room, ts);
  return {
    room,
    device: DEVICE,
    source: 'simulated',
    ts,
    co2: Math.round(910 + 490 * wave),
    temperature: Math.round((22.5 + 3.5 * wave) * 10) / 10,
  };
}
