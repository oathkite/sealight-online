import { useState } from "react";
import { isSoundOn, playSfx, setSoundOn } from "@/audio/sfx";
import { Glyph } from "@/components/icons/Glyph";
import type { GraphicsSetting } from "@/game/graphics";

type HudProps = {
  readonly fps: number;
  readonly graphics: GraphicsSetting;
  readonly onGraphics: (setting: GraphicsSetting) => void;
};

const GRAPHICS: readonly (readonly [GraphicsSetting, string, string])[] = [
  ["auto", "自動", "端末に合わせて選ぶ"],
  ["low", "低", "軽さ優先。影と模様を粗く、草を少なく"],
  ["medium", "中", "スマホ向けのちょうどよさ"],
  ["high", "高", "影も模様も細かく、草がいっぱい"],
];

/** 画質と音の設定。画質を変えると、描き直しのために場面を作り直す */
const Settings = ({ graphics, onGraphics }: Omit<HudProps, "fps">) => {
  const [sound, setSound] = useState(isSoundOn);
  return (
    <section id="settings" className="settings panel" aria-label="設定">
      <h3 className="ribbon">画質</h3>
      <div className="settings-options" role="radiogroup" aria-label="画質">
        {GRAPHICS.map(([value, label, hint]) => (
          <button key={value} type="button" role="radio" aria-checked={graphics === value} className={graphics === value ? "selected" : ""} onClick={() => onGraphics(value)}>
            <strong>{label}</strong>
            <span className="muted">{hint}</span>
          </button>
        ))}
      </div>
      <h3 className="ribbon">音</h3>
      <button
        type="button"
        aria-pressed={sound}
        onClick={() => {
          setSoundOn(!sound);
          setSound(isSoundOn());
          if (isSoundOn()) playSfx("reveal");
        }}
      >
        <Glyph name={sound ? "soundOn" : "soundOff"} /> {sound ? "効果音あり" : "効果音なし"}
      </button>
    </section>
  );
};

/** 画面の上の帯。題字と、設定の入口。設定は Esc でも閉じる */
export const Hud = ({ fps, graphics, onGraphics }: HudProps) => {
  const [open, setOpen] = useState(false);
  return (
    <header className="hud" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <span className="crest" aria-hidden="true">
        Sealight
      </span>
      <span className="hud-right">
        <span className="hud-fps">{fps} fps</span>
        <button type="button" className="hud-button" aria-label="設定" aria-expanded={open} aria-controls="settings" onClick={() => setOpen(!open)}>
          <Glyph name="gear" size={20} />
        </button>
      </span>
      {open ? <Settings graphics={graphics} onGraphics={onGraphics} /> : null}
    </header>
  );
};
