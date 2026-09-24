## Desktop app for Superpowers

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://github.com/superpowers/superpowers-app/blob/master/LICENSE.txt)
[![Gitter](https://img.shields.io/gitter/room/superpowers/dev.svg)](https://gitter.im/superpowers/dev)  
[![Patreon](https://img.shields.io/badge/patreon-support%20us-brightgreen.svg)](https://www.patreon.com/SparklinLabs)
[![Twitter](https://img.shields.io/twitter/follow/SuperpowersDev.svg?style=social)](https://twitter.com/SuperpowersDev)

[Website](http://superpowers-html5.com/) —
[Main repository](https://github.com/superpowers/superpowers-core) —
[How to contribute](http://docs.superpowers-html5.com/en/development/how-to-contribute) —
[Build instructions](http://docs.superpowers-html5.com/en/development/building-superpowers)

![](http://i.imgur.com/xqspDRS.gif)

## Development

Requires Node.js 24+.

```sh
npm install
npm run dev        # build and launch; core & data live in ./.dev-core
npm run lint
npm run typecheck
npm test           # unit tests (Vitest)
npm run build && npx playwright test   # end-to-end smoke test
npm run package    # installers for the current platform, in ./dist
```

Project layout:

- `src/main/`: Electron main process
- `src/preload/supapp.ts`: the `SupApp` API injected into server & project webviews ([compatibility notes](docs/supapp-compat.md))
- `src/renderer/`: launcher UI (legacy Pug/Stylus, being replaced)
- `src/shared/`: code shared between processes
- `resources/`: icons and locales
