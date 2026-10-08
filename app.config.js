const variant = process.env.APP_VARIANT ?? "production";

const packageSuffix = {
  development: ".dev",
  preview: ".preview",
  production: "",
}[variant];

const appName = {
  development: "GymTrackr (Dev)",
  preview: "GymTrackr (Preview)",
  production: "GymTrackr",
}[variant];

module.exports = ({ config }) => ({
  ...config,
  name: appName,
  android: {
    ...config.android,
    package: `com.charkurylab.gymtrackr${packageSuffix}`,
  },
});
