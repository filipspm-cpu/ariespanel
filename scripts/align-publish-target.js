const fs = require("fs");
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ref = process.env.GITHUB_REF || "";
const input = (process.env.RELEASE_CHANNEL || "").toLowerCase();
const isBeta =
  input === "beta" ||
  /-beta/i.test(pkg.version || "") ||
  /-beta/i.test(ref);

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
console.log(`publish -> ${owner}/${repo} (${isBeta ? "beta / prerelease" : "stable / release"})`);
