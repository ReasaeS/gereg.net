import { Container, Graphics, Text } from "pixi.js";
import type { Sound, SoundSource, Waveform } from "../../types";
import { drawSound, importAudio, loadAudio, playSound } from "../../sound";
import { getTheme } from "../../../theme/theme";
import { createText } from "../../../ui/text";
import { fieldHeight, fieldWidth } from "../../../game/field";
import type { Control, Option } from "../../../ui/widgets";
import type { Studio } from "../studio";

const waveOptions: Array<Option<Waveform>> = [
  { value: "square", label: "Square" },
  { value: "sine", label: "Sine" },
  { value: "sawtooth", label: "Saw" },
  { value: "triangle", label: "Triangle" },
  { value: "noise", label: "Noise" },
];
const sourceOptions: Array<Option<SoundSource>> = [
  { value: "synth", label: "Synth" },
  { value: "file", label: "File" },
];
const soundDelay: number = 250; // ms
const soundNameGap: number = 12; // units
const soundNameSize: number = 8; // units
const pitchMin: number = 40; // Hz
const pitchMax: number = 2000; // Hz
const soundPlotWidth: number = 320; // units
const soundPlotHeight: number = 160; // units

type SoundTab = {
  plot: Container;
  useAudio: (file: File | undefined) => Promise<void>;
};

function addSoundTab(studio: Studio): SoundTab {
  const { creations, preview, tab, addTab, changed, refresh, cleanup } = studio;
  const { slider, choice, section, actionRow } = studio.kit;
  const { sound } = studio.pick;
  const plot: Container = new Container();
  const soundGraph: Graphics = new Graphics();
  const soundName: Text = createText(soundNameSize, "#ffffff");
  let soundTimer: number | null = null;

  function hearSound(): void {
    if (soundTimer !== null) {
      window.clearTimeout(soundTimer);
    }

    soundTimer = window.setTimeout(() => {
      soundTimer = null;

      if (tab().name === "sound") {
        playSound(sound());
      }
    }, soundDelay);
  }

  function soundSlider(
    name: string,
    min: number,
    max: number,
    step: number,
    key: "pitch" | "slide" | "attack" | "sustain" | "decay" | "volume",
  ): Control {
    return slider(
      name,
      min,
      max,
      step,
      () => sound()[key],
      (value: number) => {
        sound()[key] = value;
        hearSound();
      },
    );
  }

  function randomSound(): void {
    const value: Sound = sound();
    const pick: (min: number, max: number) => number = (
      min: number,
      max: number,
    ) => min + Math.random() * (max - min);

    value.wave =
      waveOptions[Math.floor(Math.random() * waveOptions.length)]!.value;
    value.pitch = Math.round(pick(pitchMin, pitchMax) / 10) * 10;
    value.slide = Math.round(pick(pitchMin, pitchMax) / 10) * 10;
    value.attack = Math.round(pick(0, 0.1) * 100) / 100;
    value.sustain = Math.round(pick(0, 0.3) * 100) / 100;
    value.decay = Math.round(pick(0.05, 0.8) * 50) / 50;
    value.vibratoDepth =
      Math.random() < 0.5 ? 0 : Math.round(pick(0, 4) * 2) / 2;
    value.vibratoRate = Math.round(pick(2, 20) * 2) / 2;
    changed();
    refresh();
    playSound(value);
  }

  addTab(
    "sound",
    () => creations.sounds,
    [
      ...section("Sound", [
        choice(
          "Source",
          () => sourceOptions,
          () => sound().source,
          (value: SoundSource) => {
            sound().source = value;
            hearSound();
          },
        ),
        {
          ...actionRow("Play", () => playSound(sound()), "Random", randomSound),
          shown: () => sound().source === "synth",
        },
        {
          ...actionRow(
            "Play",
            () => playSound(sound()),
            "Import",
            () => audioPicker.click(),
          ),
          shown: () => sound().source === "file",
        },
        soundSlider("Volume", 0.05, 1, 0.05, "volume"),
      ]),
      ...section(
        "Tone",
        [
          choice(
            "Wave",
            () => waveOptions,
            () => sound().wave,
            (value: Waveform) => {
              sound().wave = value;
              hearSound();
            },
          ),
          soundSlider("Pitch", pitchMin, pitchMax, 10, "pitch"),
          soundSlider("Slide to", pitchMin, pitchMax, 10, "slide"),
          slider(
            "Vibrato depth",
            0,
            12,
            0.5,
            () => sound().vibratoDepth,
            (value: number) => {
              sound().vibratoDepth = value;
              hearSound();
            },
          ),
          slider(
            "Vibrato rate",
            0,
            30,
            0.5,
            () => sound().vibratoRate,
            (value: number) => {
              sound().vibratoRate = value;
              hearSound();
            },
          ),
        ],
        () => sound().source === "synth",
      ),
      ...section(
        "Envelope",
        [
          soundSlider("Attack", 0, 0.5, 0.01, "attack"),
          soundSlider("Sustain", 0, 1, 0.01, "sustain"),
          soundSlider("Decay", 0.02, 2, 0.02, "decay"),
        ],
        () => sound().source === "synth",
      ),
    ],
    () => {
      const value: Sound = sound();

      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSigil(null);
      plotSound(value);
      void loadAudio(value.file).then(() => {
        if (tab().name === "sound" && sound() === value) {
          plotSound(value);
        }
      });
    },
  );

  function plotSound(value: Sound): void {
    drawSound(
      soundGraph,
      value,
      soundPlotWidth,
      soundPlotHeight,
      getTheme().ring,
    );
    soundName.text =
      value.source === "file"
        ? (value.fileName || "NO FILE").toUpperCase()
        : "";
  }

  const audioPicker: HTMLInputElement = document.createElement("input");

  audioPicker.type = "file";
  audioPicker.accept = "audio/*";
  audioPicker.addEventListener("change", () => {
    useAudio(audioPicker.files?.[0]);
    audioPicker.value = "";
  });

  async function useAudio(file: File | undefined): Promise<void> {
    if (file === undefined || tab().name !== "sound") {
      return;
    }

    const value: Sound = sound();

    try {
      value.file = await importAudio(file);
      value.fileName = file.name;
      value.source = "file";
      changed();
      refresh();
      cleanup();
      playSound(value);
    } catch {
      window.alert(
        '"' + file.name + '" is not an audio file this browser can play.',
      );
    }
  }

  plot.position.set(
    (fieldWidth - soundPlotWidth) / 2,
    (fieldHeight - soundPlotHeight) / 2,
  );
  soundName.anchor.set(0.5, 0);
  soundName.position.set(soundPlotWidth / 2, soundPlotHeight + soundNameGap);
  plot.addChild(soundGraph, soundName);

  return { plot: plot, useAudio: useAudio };
}

export { addSoundTab };
export type { SoundTab };
