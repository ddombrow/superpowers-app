// Remote services the app talks to.
// TODO: Make these configurable from the settings (plan: Phase 4)

export const registryURL = "https://raw.githubusercontent.com/superpowers/superpowers-registry/master/registry.json";

export const appReleases = {
  latestAPI: "https://api.github.com/repos/ddombrow/superpowers-app/releases/latest",
  latestPage: "https://github.com/ddombrow/superpowers-app/releases/latest"
};

export const newsURL = (languageCode: string) => `http://superpowers-html5.com/news.${languageCode}.html`;

export const ircNetwork = { host: "irc.libera.chat", port: 6697 };
