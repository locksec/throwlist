# Throwlist: product requirements

Throwlist is an open list of email domains that hand out throwaway addresses: inboxes
anyone can open for a few minutes without signing up. Sites use it to refuse those
addresses at sign-up, where a throwaway inbox usually means a second free trial, a fake
account or abuse.

It combines the best open-source lists with domains Throwlist collects itself from the
throwaway email services, and it records where and when each domain was seen. It is
published as plain text files in a public GitHub repository, and every change to the
list is a reviewed pull request.

## Why

- **The open lists differ.** Curated lists are accurate but slow to catch new domains;
  large automated lists are fast but include real providers by mistake. A sign-up form
  needs both: new throwaway domains quickly, and no real person refused.
- **Throwaway services add domains all the time.** A web search for "temp email" returns
  dozens of services, many of which rotate through new domains weekly. Watching the
  services directly finds those domains before any list does.
- **The first user is UnApply.io,** which refuses throwaway addresses at sign-up and
  sign-in. Other projects can use the same list.

## Principles

1. **No real person refused.** A domain that hosts real, lasting mailboxes is never on the
   list. The allowlist always wins over every source.
2. **Every domain has evidence.** Each entry records which sources or services it came
   from, and when it was first and last seen.
3. **Domains only.** The repository holds domain names and the public pages they were seen
   on. Never an email address, an inbox's contents, or anything about the people who use
   a site that consumes the list.
4. **Polite collection.** Robots rules and each service's terms are respected, every
   request identifies itself, and nothing is collected by getting around a bot check.
5. **Reviewed changes.** Automation proposes; a maintainer merges. Nothing changes the
   published list without a pull request.

## What counts as a throwaway domain

**On the list:** a domain whose addresses a stranger can receive mail at without an
account, or with an account that exists only for minutes or hours: temporary inbox
sites, "10 minute mail" services, and their rotating domains. Forwarding services whose
addresses expire by design (TrashMail, Spamgourmet, Jetable) are on the list too, since
the address stops working.

**Not on the list:**
- Ordinary mail providers (Gmail, Outlook, iCloud, Yahoo, Proton, Fastmail, GMX, Zoho,
  Tuta and the like), whatever any source says.
- **Lasting forwarding and alias services** (Apple Hide My Email, Firefox Relay,
  DuckDuckGo Email Protection, SimpleLogin, addy.io, Proton Pass, 33mail, Fastmail masked
  email). They forward to a real, lasting inbox and protect people's privacy. They are
  published in a separate file, `relays.txt`, so a site can decide for itself; the main
  list never includes them.
- Public suffixes themselves (`co.uk`, `com.au`): a listed domain must be a registrable
  domain or a subdomain of one. Free subdomain and dynamic DNS hosts missing from the
  Public Suffix List (`mooo.com`, `us.to`) are treated as public suffixes too, in
  `data/shared_suffixes.txt`, so a person running their own mail on a subdomain is never
  refused.

## Sources

### Open-source lists

Merged on every refresh. Each source's license is recorded in `sources.yml` and its notice
kept in `NOTICE`; a source is used only if its license allows redistribution.

| Source | License | Trust | Character |
| --- | --- | --- | --- |
| [disposable-email-domains/disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) | CC0 | On its own | About 9,200 domains, reviewed by hand; each addition needs proof |
| [7c/fakefilter](https://github.com/7c/fakefilter) | BSD-3-Clause | On its own | Automated daily from watched services, with first and last seen dates |
| [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains), its own crawls | MIT | On its own | Domains its crawlers read from throwaway services, taken from its per-domain source map |
| [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains), the other lists it compiles | MIT | Needs a second source | throwaway.cloud and smaller lists, skipping the ones Throwlist reads directly |
| [FGRibreau/mailchecker](https://github.com/FGRibreau/mailchecker), [wesbos/burner-email-providers](https://github.com/wesbos/burner-email-providers), [unkn0w/disposable-email-domain-list](https://github.com/unkn0w/disposable-email-domain-list) | MIT | Needs a second source | Large community lists that overlap heavily, so they count as one family |

A "needs a second source" domain is listed only when a source from another family, or a
source trusted on its own, agrees. Sources that copy from each other share a family, so a
copy never counts as a second opinion. The larger aggregations (ivolo, tompec,
valid_email2) were left out: they are mostly copies of the lists above, and the strict
list from disposable/disposable includes Outlook, Hotmail and Proton.

### Our own collection

Throwlist watches the throwaway email services directly.

1. **A registry of services** (`services.yml`): each service's address, how its domains
   are read, its robots and terms status, when it was last checked, and whether it is
   active.
2. **Finding services:** a maintainer searches the web for "temp email", "temporary
   email", "disposable email", "10 minute mail", "fake email generator" and their
   equivalents in other languages, and adds new services to the registry. Search
   engines' terms forbid scraping their results, so finding services stays a person's
   job, never an automated search.
3. **Reading domains**, in order of preference:
   - a public API the service documents for listing its domains;
   - the service's own page, where it shows the domains it offers or the address it
     generated;
   - a headless browser for pages that build the address in script, only where the
     service's terms allow automated visits.
4. **Where terms forbid automated visits,** a maintainer may record the domains seen on a
   normal visit by hand, with the date and the page as evidence, and the service stays
   on `read: manual`.
5. **Observations** go in `observations.tsv`: domain, service, first and last seen, how
   it was read (`api`, `page` or `visit`) and the page. Readers never delete a row, so
   removing one is a correction.
6. **What collection never does:** solve or bypass a CAPTCHA or bot check, create
   accounts, send email, read inbox contents, or visit a service more than once per run.
   Each request carries `ThrowlistBot/<version> (+https://github.com/locksec/throwlist)`.

## Merging

1. **Normalize** every entry: lowercase, trim, strip a leading `*.` or `.`, convert
   international names to their ASCII form, drop anything that is not a valid domain.
2. **Guard** against the public suffix list and `data/shared_suffixes.txt`: a public
   suffix or an unknown top-level domain is never listed.
3. **Combine** sources with their evidence: sources, first seen, last seen.
4. **Apply the allowlist,** which removes a domain and its subdomains whatever its
   sources say, and move relay services to `relays.txt`.
5. **Hold back** domains that only one family of "needs a second source" sources names,
   and those sources' domains under education or government suffixes (`edu.sg`,
   `ac.uk`), which only a source trusted on its own can list.
6. **Hold back** domains whose mail, at the last MX check, goes to Google Workspace,
   Microsoft 365, iCloud, Proton or a similar paid host, unless a watching source
   (FakeFilter, the aggregator's crawls, Throwlist) saw a throwaway service hand them out.
   Throwaway domains change hands, and these most likely belong to a business or a
   person now. They are kept in `data/paid_mail_hosts.tsv`.
7. **Leave out** subdomains of listed domains, since sites check parents anyway.
8. **Report** what changed: domains added and removed, by source, with a sample of each,
   and new domains that borrow a real provider's name.

If a source fails to download, or shrinks by more than 30% since the last release, its
domains carry over from the last release and the report says so.

A domain stays listed when it stops appearing on a service, since old throwaway domains
often keep accepting mail. Its last-seen date says how fresh it is. A monthly DNS check
records whether each domain still has mail servers (MX records); a domain with none is
marked, not removed. The same check records paid mail hosts for the hold-back rule above.

## What is published

| File | Contents |
| --- | --- |
| `domains.txt` | The list: one domain per line, lowercase, ASCII, sorted |
| `domains.json` | The same domains with sources, first seen, last seen and MX status |
| `allowlist.txt` | Domains that are never listed, with a reason for each in `allowlist.yml` |
| `relays.txt` | Forwarding and alias services, kept apart from the list, from `relays.yml` |
| `services.yml` | The watched services and how each is read |
| `observations.tsv` | Domains seen on the watched services, with dates and the page |
| `sources.yml`, `NOTICE` | The open-source lists used, their licenses and notices |
| `data/shared_suffixes.txt` | Free subdomain and dynamic DNS hosts treated as public suffixes |
| `data/paid_mail_hosts.tsv` | Domains whose mail goes to a paid organization host, from the MX check |
| `CHANGELOG.md` | Each release: counts added and removed |

**How a site uses it:** a domain is throwaway when it, or any parent domain of it, is in
`domains.txt` (so `abc.mailinator.com` matches `mailinator.com`). Sites should pin a
release tag and copy the files into their own repository rather than read GitHub while
they run, so a GitHub outage or a bad commit never affects their sign-ups.

## Releases and upkeep

- **Weekly refresh,** run by a scheduled GitHub Action: merge the open sources, read the
  watched services, open a pull request with the change report. It never merges itself.
- **A maintainer reviews** the pull request: spot-checks new domains, looks into any domain
  that resembles a real provider, then merges.
- **Each merge is tagged** as a release, named by the date the list was built
  (`v2026.10.08`). The monthly MX check opens its own pull request the same way.
- **Reports from sites:** a site may report domains it sees often that are not listed
  (the domain only, never an address). A maintainer checks each one and adds it with
  evidence.
- **False positives:** an issue or pull request adds the domain to the allowlist with its
  reason; it is removed from the list in the next release.

## Consumers

**UnApply.io** is the first. Its refresh script copies a tagged release's `domains.txt` and
`allowlist.txt` into its own repository and prints the counts added and removed for review
before deploy. It refuses a throwaway address at sign-up and sign-in with "Use a permanent
email address," checks the domain's parent domains, and confirms the domain has mail
servers.

## Technology

- Node.js with ES modules, no build step for the published files.
- Playwright for the headless reads only, once phase 3 starts.
- Tests run without the network: normalization, the public suffix guard, allowlist
  precedence, relay separation, "needs a second source", and each service's reader
  against a saved copy of its page or API answer.
- GitHub Actions for the weekly refresh and for checks on every pull request.

## Not in scope

- An API or hosted service. Throwlist is files.
- Checking whether a particular address or mailbox exists (no SMTP probing).
- Role accounts (`admin@`, `noreply@`) and typo domains (`gmial.com`); possible later as
  separate files.

## Phases

1. **The merge:** the repository, normalization, the public suffix guard, the allowlist,
   relays, the two curated sources, published files, tests, and checks on pull requests.
   First release. *Done.*
2. **Our own collection:** the service registry, readers for services with public APIs
   and plain pages, and the first round of finding services by search. *Done: 231
   services in 23 languages, 18 with readers.*
3. **Headless reads** for script-built pages, where terms allow. 72 services build
   their addresses in script.
4. **Automation:** the weekly pull request, release tags, the monthly MX check. *Done.*
5. **More sources:** evaluate the larger lists with "needs a second source". *Done.*
6. **UnApply.io** pins its first release.

## Measures

- **No false positives:** no allowlisted or major provider ever listed; any report fixed in
  the next release.
- **Freshness:** days between a domain first appearing on a watched service and its
  release.
- **Coverage:** how many of the watched services' current domains are listed.
- **Evidence:** every listed domain has at least one source or observation with a date.

## License

Code under MIT (`LICENSE`); Throwlist's own data under CC0 (`LICENSE-DATA`); each
source's notice kept in `NOTICE`.
