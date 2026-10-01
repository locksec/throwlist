# Throwlist

Throwlist is a list of email domains that hand out throwaway addresses: inboxes anyone can open for a few minutes without signing up. Use it to refuse those addresses at sign-up, where they usually mean a second free trial, a fake account or abuse.

Every domain has evidence: the temp mail service seen handing it out, or the established list that records it, with dates. Real mail providers are never on it, and neither are privacy relays like Apple's Hide My Email.

The first release, `v2026.10.01`, lists **24,898 domains**. [`CHANGELOG.md`](CHANGELOG.md) has the count for each release.

## Files

| File | What it is |
| --- | --- |
| [`domains.txt`](domains.txt) | The list. One domain per line, lowercase ASCII, sorted. |
| [`domains.json`](domains.json) | The same domains with where each was seen, when, and whether it has mail servers. |
| [`relays.txt`](relays.txt) | Forwarding and alias services that reach a real inbox. Never on the main list. |
| [`allowlist.txt`](allowlist.txt) | Real mail providers that are never listed. |

## Using it

Check the address's domain and each of its parents: `someone@abc.mailinator.com` is throwaway because `mailinator.com` is listed.

Pin a release and copy the files into your own repository, so a GitHub outage or a bad commit never touches your sign-ups.

```sh
curl -LO https://github.com/locksec/throwlist/releases/latest/download/domains.txt
```

JavaScript:

```js
import { readFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';

const throwaway = new Set(readFileSync('domains.txt', 'utf8').split('\n').filter(Boolean));

export function isThrowaway(email) {
  const domain = domainToASCII(email.split('@').pop().trim().toLowerCase().replace(/\.$/, ''));
  const labels = domain.split('.');
  return labels.some((_, i) => throwaway.has(labels.slice(i).join('.')));
}
```

Python:

```python
throwaway = set(open("domains.txt").read().split())

def is_throwaway(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].strip().lower().rstrip(".").encode("idna").decode()
    labels = domain.split(".")
    return any(".".join(labels[i:]) in throwaway for i in range(len(labels)))
```

## What is on the list

Domains whose addresses anyone can receive mail at without an account, or with an account that lasts only minutes or hours: temp inbox sites, "10 minute mail" services and the domains they rotate through. Forwarding services whose addresses expire by design, like TrashMail and Spamgourmet, are on it too.

Never on the list:

- Real mail providers: Gmail, Outlook, iCloud, Yahoo, Proton, Fastmail, GMX, Zoho, Tuta and about 140 more, in [`allowlist.yml`](allowlist.yml).
- Lasting forwarding and alias services: Apple Hide My Email, Firefox Relay, DuckDuckGo Email Protection, SimpleLogin, addy.io, Proton Pass and others, in [`relays.txt`](relays.txt).
- Hosts that give anyone a subdomain, like `mooo.com` or `us.to`. A throwaway service's own subdomain on one can be listed, but never the host itself.

## Domains Throwlist found itself

Throwlist searches the web for temp mail services in 23 languages ("temp mail", "email jetable", "Wegwerf E-Mail", "correo temporal", "临时邮箱", "временная почта" and many more), visits each service, and records the domains it hands out. The first search found 231 services and recorded 444 domains from them, each checked against the page it appeared on. At the first release, 79 of those domains were on no other public list.

[`observations.tsv`](observations.tsv) lists every domain Throwlist recorded, with the service, the page and the date. [`services.yml`](services.yml) describes each service. In `domains.json` these domains carry the source `throwlist`.

## How it is kept current

Eighteen services publish their domains openly and are read every week by ThrowlistBot, which follows robots.txt and each service's terms and makes one request per service.

Throwlist also merges the established open lists credited below. Throwaway domains change hands, so a monthly check of every domain's mail servers finds those that have passed to a business or a person and takes them off. Each week's changes are reviewed before they are released.

### domains.json

```json
{"domain":"necub.com","sources":["dea","disposable-lists","fakefilter","throwlist"],"services":["tempail.com"],"first_seen":"2025-07-18","last_seen":"2026-10-01","mx":true}
```

| Field | Meaning |
| --- | --- |
| `sources` | Where the domain is recorded, from [`sources.yml`](sources.yml). `throwlist` means Throwlist saw it itself. |
| `services` | The temp mail services Throwlist saw handing it out. |
| `first_seen` | When it was first recorded. |
| `last_seen` | When a temp mail service was last seen handing it out, or `null` if never. |
| `mx` | Whether it had mail servers at the last check. |

## Reporting a domain

- [A throwaway domain that is missing](https://github.com/locksec/throwlist/issues/new?template=add-domain.yml): send the domain and the page that hands it out.
- [A real provider on the list](https://github.com/locksec/throwlist/issues/new?template=false-positive.yml): it comes off in the next release.

## Credits

Throwlist builds on these open lists, with thanks to their maintainers: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains), [FakeFilter](https://github.com/7c/fakefilter), [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains), [MailChecker](https://github.com/FGRibreau/mailchecker), [burner-email-providers](https://github.com/wesbos/burner-email-providers) and [disposable-email-domain-list](https://github.com/unkn0w/disposable-email-domain-list).

## Maintaining

Node.js 22 or later.

| Command | What it does |
| --- | --- |
| `npm run refresh` | Downloads the open lists, reads the weekly services, and rebuilds the published files. Writes the change report to `report.md`. |
| `npm run observe -- <service> <domain> --page <url>` | Records a domain seen on a service. |
| `npm run mx` | Checks every listed domain's mail servers. |
| `npm run check` | Checks the published files. Runs on every pull request. |
| `npm test` | Runs the tests. |

Every Monday a GitHub Action runs the refresh and opens a pull request with the change report, and the mail server check does the same on the first of each month. Each merge becomes a release tagged with its date.

## License

Code under the [MIT License](LICENSE). Throwlist's own data is public domain under [CC0](LICENSE-DATA). Domains from the lists above stay under their own licenses; [`NOTICE`](NOTICE) keeps each one's notice.
