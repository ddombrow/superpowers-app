// Remote services the app talks to.
// TODO: Make these configurable from the settings (plan: Phase 4)

export const registryURL = "https://raw.githubusercontent.com/superpowers/superpowers-registry/master/registry.json";

export const appReleases = {
  latestAPI: "https://api.github.com/repos/ddombrow/superpowers-app/releases/latest",
  latestPage: "https://github.com/ddombrow/superpowers-app/releases/latest"
};

export const newsURL = (languageCode: string) => `http://superpowers-html5.com/news.${languageCode}.html`;

export const ircNetwork = { host: "irc.libera.chat", port: 6697 };

/** Links on the home page; `key` is under "home:links" in the locales */
export const homeLinks = [
  { key: "documentation", url: "https://github.com/superpowers/docs.superpowers-html5.com" },
  { key: "forums", url: "https://itch.io/engine/superpowers/community" },
  { key: "openSource", url: "https://github.com/superpowers" },
  { key: "freeAssets", url: "https://github.com/sparklinlabs/superpowers-asset-packs" }
];

/** Community chatrooms on the home page; `key` is under "home:chatrooms" in the locales */
export const homeChatrooms = [
  { key: "en", channel: "#superpowers-html5" },
  { key: "fr", channel: "#superpowers-html5-fr" }
];
