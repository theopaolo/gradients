// Entry point. gradient.js boots the renderer, config.js builds the panel on
// top of it, and motion.js runs the intro — importing config pulls in both.
// pwa.js is independent of all three: it only installs the offline copy.
import "./config.js";
import "./pwa.js";
