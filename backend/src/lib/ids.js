const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomId(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

function randomKey() {
  let s = "";
  for (let i = 0; i < 32; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s.toLowerCase();
}

module.exports = { randomId, randomKey };
