// Records domains a maintainer saw on a normal visit to a service, with the page as evidence.
// Usage: npm run observe -- <service-id> <domain> [<domain> ...] [--page <url>]
import { loadServices } from '../src/config.js';
import { normalize } from '../src/domain.js';
import { readObservations, recordSightings, writeObservations } from '../src/observations.js';

const args = process.argv.slice(2);
const pageAt = args.indexOf('--page');
const page = pageAt >= 0 ? args.splice(pageAt, 2)[1] : undefined;
const [serviceId, ...raw] = args;

const service = loadServices().find(s => s.id === serviceId);
if (!service || raw.length === 0) {
  console.error('Usage: npm run observe -- <service-id> <domain> [<domain> ...] [--page <url>]');
  console.error(service ? 'Name at least one domain.' : `No service "${serviceId}" in services.yml. Add it there first.`);
  process.exit(1);
}

const domains = raw.map(r => {
  const d = normalize(r);
  if (!d) {
    console.error(`Not a valid domain: ${r}`);
    process.exit(1);
  }
  return d;
});

const date = new Date().toISOString().slice(0, 10);
const evidence = page ?? service.url;
const { rows, added } = recordSightings(
  readObservations(),
  domains.map(domain => ({ domain, service: service.id, date, how: 'visit', evidence })),
);
writeObservations(rows);
console.log(`${added.length} new, ${domains.length - added.length} already recorded (last seen moved to ${date}).`);
