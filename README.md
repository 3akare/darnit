# DarnIt!

A daily one-line puzzle on Reddit: sew one thread through numbered buttons, in order, filling
every cell of the fabric. Built on Devvit Web for the Reddit Daily Games hackathon.

- `SPEC.md`: the game spec
- `SPIKES.md`: Day-1 platform spikes and what they changed
- `CLAUDE.md`: working rules for this repo

## Develop

Needs Node 24.

```sh
npm install
npx devvit login      # add --copy-paste when there is no local browser
npm run dev           # playtest on Reddit
```

Other commands: `npm run build`, `npm run test:types`, `npm run lint`, `npm run test:unit`,
`npm run deploy` (private upload). This app is never published with `devvit publish`.
