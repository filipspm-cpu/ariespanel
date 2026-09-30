const { pickGameWindow, scoreGameWindow } = require("../dist-electron/gameWindowScore");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const gta = { title: "", name: "GTA5.exe", className: "grcWindow" };
const launcher = { title: "Rockstar Games Launcher", name: "Launcher.exe", className: "Chrome_WidgetWin_1" };
const chrome = { title: "Gmail", name: "chrome.exe", className: "Chrome_WidgetWin_1" };
const fivem = { title: "FiveM", name: "FiveM.exe", className: "Chrome_WidgetWin_1" };
const majestic = { title: "Majestic RP", name: "GTA5.exe", className: "grcWindow" };

assert(scoreGameWindow(gta) >= 80, "empty-title GTA5/grcWindow must detect");
assert(pickGameWindow([launcher, chrome, gta]) === gta, "must pick GTA over launcher/chrome");
assert(pickGameWindow([chrome]) === null, "chrome must not count as game");
assert(pickGameWindow([fivem]) === fivem, "FiveM title/exe must detect");
assert(pickGameWindow([majestic, launcher]) === majestic, "Majestic GTA window must win");

console.log("gameWindowScore ok");
