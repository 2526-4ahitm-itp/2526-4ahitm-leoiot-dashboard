// DEMO, not a permanent part of the system: see README.md.
//
// The room ids of the 3D building model (ModelFull.gltf and ModelT.gltf), as
// listed on 2026-11-20. This copy is a deliberate one-off DEMO exception to the
// rule that a sub-project copies nothing from a sibling; it is deleted with the
// demo.
export const MODEL_ROOMS = [
  'U04','U05','U07','U08','U10','U71','U72','U73','U74','U74.1','U77','U78','U79','U81','U82','U83','U84','U85','U86','U87','U88','U89','U90','U91','U92','UBiolab',
  'E05','E07','E08','E09','E10','E11','E22','E23','E24','E25','E26','E581','E582','E59','E71','E72','E73',
  '103','104','105','106','107','108','109','119','121','122','123','124','130','131','132','133','134','142','143','144','145','146','147','148','151','152','153','154','1Aula',
  '203','204','206','213','214','215','216','217','218','226','227','228','229','230','231','237','239','241','251','252','253','254',
  'T1','T2','T3','T4','T6','T10','T11','T12','T13','T14','T15','T16','T19',
];

/**
 * The rooms the demo writes: every model room except the skipped ones. Room 105
 * has the real sensor nili3 and must never be written by the demo.
 */
export function demoRooms(skip = ['105']) {
  const skipped = new Set(skip);
  return MODEL_ROOMS.filter((room) => !skipped.has(room));
}
