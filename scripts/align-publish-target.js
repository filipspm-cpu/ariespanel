const fs = require("fs");
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.repository = { type: "git", url: `https://github.com/${owner}/${repo}.git` };
pkg.build = pkg.build || {};
pkg.build.publish = {
  ...(pkg.build.publish || {}),
  provider: "github",
  owner,
  repo,
  releaseType: "release",
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`publish -> ${owner}/${repo}`);
