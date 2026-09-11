const fs = require("fs");
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ref = process.env.GITHUB_REF || "";
const input = (process.env.RELEASE_CHANNEL || "").toLowerCase();
const tag = ref.replace(/^refs\/tags\/v?/i, "");
const tagLooksLikeVersion = /^\d+\.\d+\.\d+/.test(tag);
const isBeta =
  input === "beta" ||
  /-beta/i.test(tag) ||
  /-beta/i.test(pkg.version || "");

if (tagLooksLikeVersion) {
  pkg.version = tag;
} else if (isBeta && !/-beta/i.test(pkg.version || "")) {
  pkg.version = `${pkg.version}-beta.1`;
}

pkg.repository = { type: "git", url: `https://github.com/${owner}/${repo}.git` };
pkg.build = pkg.build || {};
pkg.build.publish = {
  ...(pkg.build.publish || {}),
  provider: "github",
  owner,
  repo,
  releaseType: isBeta ? "prerelease" : "release",
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`publish -> ${owner}/${repo} v${pkg.version} (${isBeta ? "beta / prerelease" : "stable / release"})`);
