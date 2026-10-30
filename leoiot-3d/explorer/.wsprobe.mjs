import mqtt from 'mqtt';
const c = mqtt.connect(process.argv[2]);
c.on('connect', () => c.subscribe('leoiot/room-climate/#'));
c.on('message', (t, m) => { console.log('got', t, m.toString()); c.end(); process.exit(0); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 5000);
