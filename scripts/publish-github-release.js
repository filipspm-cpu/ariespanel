const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const ver = pkg.version;
const tag = `v${ver}`;
const title = /-beta/i.test(ver) ? `ARIES ${ver} BETA` : `ARIES ${ver}`;
const dist = path.join(process.cwd(), "release");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function gh(args) {
  execFileSync("gh", args, { stdio: "inherit", env: process.env });
}

function retry(label, fn, times = 5) {
  let last;
  for (let i = 0; i < times; i++) {
    try {
      return fn();
    } catch (err) {
      last = err;
      const wait = 4000 * 2 ** i;
      console.log(`${label} failed (${i + 1}/${times}), retry in ${wait}ms`);
      sleep(wait);
    }
  }
  throw last;
}

retry("release view/create", () => {
  try {
    gh(["release", "view", tag]);
  } catch {
    gh(["release", "create", tag, "--title", title, "--notes", "", "--verify-tag"]);
  }
});

const names = [`ARIES-Setup-${ver}.exe`, `ARIES-Setup-${ver}.exe.blockmap`, "latest.yml", "beta.yml"];
const files = names.map((name) => path.join(dist, name)).filter((file) => fs.existsSync(file));
if (!files.length) {
  throw new Error(`No release files in ${dist}`);
}

for (const file of files) {
  retry(`upload ${path.basename(file)}`, () => {
    gh(["release", "upload", tag, file, "--clobber"]);
  });
}

console.log(`uploaded ${files.map((file) => path.basename(file)).join(", ")} -> ${tag}`);
