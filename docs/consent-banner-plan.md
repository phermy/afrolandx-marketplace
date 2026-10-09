# Consent before analytics

No analytics or marketing tracker is added by the security/privacy update.
Keep optional tracking disabled until the consent implementation below has been
completed and verified. This includes scripts injected by a publishing platform:
do not enable analytics in publishing settings before the consent gate supports it.

## Required behaviour

- A first visit presents **Accept optional analytics**, **Reject optional analytics**
  and **Manage choices**, with acceptance and rejection equally easy to find.
- Essential authentication, cart, security and payment cookies are explained but
  cannot be disabled by the optional-tracking choice. Shopping must work after rejection.
- Analytics and marketing categories default off. Do not download their scripts,
  set their cookies, send events or preconnect to their hosts before consent.
- Keyboard users and screen readers can reach every action. Use a labelled,
  non-blocking region rather than trapping users in a modal on first visit.
- Show purposes and named providers, with a link to the privacy policy. No preselected
  optional categories and no assumption of consent from scrolling or navigation.
- Save a versioned choice and timestamp in first-party preference storage. Renew
  consent when purposes/providers materially change. Honour applicable browser
  privacy signals; do not claim that one signal has identical legal effect everywhere.
- A permanent **Privacy choices** footer control lets users change or withdraw
  permission. Withdrawal stops future events and removes optional first-party
  cookies/storage where technically possible.
- Tracking must fail closed if preferences are unavailable. Do not record
  email, order identifiers, chat text, addresses, photos or other sensitive content
  as analytics event properties.

## Implementation locations

Use the provider tree in client/src/App.tsx for shared consent state and
client/src/components/site-footer.tsx for the permanent preferences entry.
Keep loader/event gates in one focused client module. Review client/src/main.tsx,
which currently removes injected platform elements, before integrating a platform
tracker: never rely on removing a script after it has already sent data.
Read the project-analytics skill before enabling Replit analytics; its publishing
proxy injection may require a supported consent mechanism or a different delivery
approach. The CSP in server/security-headers.ts must only allow a chosen tracker
after that design has been confirmed.

## Release checks

Check fresh visits, acceptance, rejection, withdrawal, saved choices and version
changes on desktop/mobile with keyboard and screen-reader testing. Assert network,
cookies and storage remain free of optional trackers before consent and after
rejection. Check that checkout, sign-in and anti-bot protections still function.
Update the policy with the final actual providers and purposes, then obtain privacy
review before adding tracking. No consent banner is claimed to be live yet.
