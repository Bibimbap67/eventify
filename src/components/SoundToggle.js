import React, { useSyncExternalStore } from "react";
import Icon from "./Icon.js";
import { prefersReducedMotion } from "./Motion.js";
import { isSoundOn, playSound, setSoundOn, subscribeSound } from "./sound.js";

export default function SoundToggle({ className = "" }) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn);
  const reduced = prefersReducedMotion();

  const toggle = () => {
    setSoundOn(!on);
    if (!on) playSound("tick"); // let the user hear what they just turned on
  };

  return (
    <button
      type="button"
      className={`sound-toggle${className ? ` ${className}` : ""}`}
      onClick={toggle}
      aria-label="Click sounds"
      aria-pressed={on}
      disabled={reduced}
      title={reduced ? "Sounds stay off while your device asks for reduced motion" : on ? "Mute click sounds" : "Turn on click sounds"}
    >
      <Icon name={on ? "sound" : "mute"} size={18} />
    </button>
  );
}
