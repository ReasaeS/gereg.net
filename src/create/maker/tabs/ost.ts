import type { Background, OstTrack, Sound, Wallpaper } from "../../types";
import type { Studio } from "../studio";
import { isMusic } from "../../sound";

function addOstTab(studio: Studio): void {
  const { creations, preview, cursor, addTab, changed, refresh } = studio;
  const { choice, section, actionRow } = studio.kit;
  const { ost, backgroundById, soundById } = studio.pick;

  function songs(): Array<Sound> {
    return creations.sounds.filter(isMusic);
  }

  function track(): OstTrack {
    cursor.track = Math.min(cursor.track, ost().tracks.length - 1);

    return ost().tracks[cursor.track]!;
  }

  function selectTrack(index: number): void {
    cursor.track = index;
    refresh();
  }

  function moveTrack(step: number): void {
    const tracks: Array<OstTrack> = ost().tracks;
    const target: number = cursor.track + step;

    if (target < 0 || target >= tracks.length) {
      return;
    }

    const moved: OstTrack = tracks[cursor.track]!;

    tracks[cursor.track] = tracks[target]!;
    tracks[target] = moved;
    changed();
    selectTrack(target);
  }

  addTab(
    "ost",
    () => creations.osts,
    [
      ...section("Tracks", [
        actionRow(
          "Add track",
          () => {
            const used: Set<string | null> = new Set(
              ost().tracks.map((value: OstTrack) => value.sound),
            );
            const source: OstTrack = track();

            ost().tracks.splice(cursor.track + 1, 0, {
              sound:
                songs().find((value: Sound) => !used.has(value.id))?.id ?? null,
              background: source.background,
              wallpaper: source.wallpaper,
            });
            changed();
            selectTrack(cursor.track + 1);
          },
          "Remove track",
          () => {
            if (ost().tracks.length <= 1) {
              return;
            }

            ost().tracks.splice(cursor.track, 1);
            changed();
            selectTrack(Math.max(cursor.track - 1, 0));
          },
        ),
        actionRow(
          "Move up",
          () => moveTrack(-1),
          "Move down",
          () => moveTrack(1),
        ),
        choice(
          "Track",
          () =>
            ost().tracks.map((value: OstTrack, index: number) => ({
              value: index,
              label:
                index + 1 + "  ·  " + (soundById(value.sound)?.name ?? "None"),
            })),
          () => cursor.track,
          (value: number) => selectTrack(value),
        ),
      ]),
      ...section("Track", [
        choice(
          "Song",
          () => [
            { value: null, label: "None" },
            ...songs().map((value: Sound) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => track().sound,
          (value: string | null) => {
            track().sound = value;
          },
          "sound",
        ),
        choice(
          "Background",
          () => [
            { value: null, label: "None" },
            ...creations.backgrounds.map((value: Background) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => track().background,
          (value: string | null) => {
            track().background = value;
          },
          "background",
        ),
        choice(
          "Wallpaper",
          () => [
            { value: null, label: "None" },
            ...creations.wallpapers.map((value: Wallpaper) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => track().wallpaper,
          (value: string | null) => {
            track().wallpaper = value;
          },
          "wallpaper",
        ),
      ]),
    ],
    () => {
      preview.setBackground(backgroundById(track().background));
      preview.setPlayerVisible(false);
      preview.setPattern(null);
    },
  );
}

export { addOstTab };
