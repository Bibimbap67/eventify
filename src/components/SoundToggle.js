import React, { useSyncExternalStore } from "react";
import Icon from "./Icon.js";
import { prefersReducedMotion } from "./Motion.js";
import { isSoundOn, playSound, setSoundOn, subscribeSound } from "./sound.js";

export default function SoundToggle({ className = "" }) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn);
  const reduced = prefersReducedMotion();

  const toggle = () => {
    setSoundOn(!on);
    if (!on) playSound("switch-on"); // let the user hear what they just turned on
  };

  let title = "Turn on click sounds";
  if (reduced) {
    title = "Sounds stay off while your device asks for reduced motion";
  } else if (on) {
    title = "Mute click sounds";
  }

  return (
    <button
      type="button"
      className={`sound-toggle${className ? ` ${className}` : ""}`}
      onClick={toggle}
      aria-label="Click sounds"
      aria-pressed={on}
      disabled={reduced}
      title={title}
    >
      <Icon name={on ? "sound" : "mute"} size={18} />
    </button>
  );
}
