const lessons: Map<string, Array<string>> = new Map([
  [
    "menu",
    [
      "Hi, I'm Plip! I keep the rain company around here. Press F1 on any screen and I'll tell you what it's for.",
      "PLAY is where you fly. CUSTOMISE lets you draw your own ship. CREATE is where you build stages, enemies, music and more.",
      "STATS keeps your records and achievements, CONFIG holds the settings, and CREDITS rolls the names behind all this.",
    ],
  ],
  [
    "play.modes",
    [
      "Pick how you want to play. Single player runs the games you have, including the ones you build in CREATE.",
      "Zen lets you roam under your own skies with your soundtracks, no pressure at all.",
      "Watch hands the controls to the autopilot so you can see your stages played. Multiplayer isn't open yet.",
    ],
  ],
  [
    "play.custom",
    [
      "These are your games, runs and stages. A game holds a run for each difficulty, a run is stages in a row, and a stage is one level.",
      "Press F to favourite one so it stays near the top. Press / to search the list.",
    ],
  ],
  [
    "play.difficulty",
    [
      "Choose a difficulty. Each one plays its own run, so harder settings can mean different stages, not just faster bullets.",
    ],
  ],
  [
    "play.start",
    [
      "Play the full run, or pick a single stage to practise it. Practice is a calm way to learn a tough part, but it doesn't set records.",
    ],
  ],
  [
    "play.stages",
    ["Pick a stage to play. Press / to search the list if it gets long."],
  ],
  [
    "play.zen-menu",
    [
      "Pick a soundtrack for Zen. Each track brings its own song, sky and frame, built from OST cards in CREATE.",
    ],
  ],
  [
    "play.multiplayer",
    [
      "Flying together isn't ready yet. I'm saving you a seat under my umbrella!",
    ],
  ],
  [
    "play.run",
    [
      "I paused the run for you. Dodge the bullets and shoot the enemies. Your real hitbox is tiny, much smaller than your ship.",
      "Hold focus to slow down and see that hitbox, perfect for squeezing through tight gaps.",
      "Brushing past bullets without getting hit is a graze, and every graze adds to your score.",
      "Bombs clear the screen. If you bomb right as you get hit, you're saved, but the window is very short!",
      "Getting hit costs a life and some power. Power sets how many drones fly with you, so collect the power items enemies drop.",
      "Point items add to your score. Score enough and some games give you an extra life.",
    ],
  ],
  [
    "play.zen",
    [
      "Zen has no enemies and no score. Just you, the sky and the music.",
      "Press N for the next sky. Comma and period skip songs, and P pauses the music.",
    ],
  ],
  [
    "play.watch",
    [
      "The autopilot is flying your stages. Press the shoot key to switch between normal, double and quadruple speed.",
      "Press Esc when you've seen enough.",
    ],
  ],
  [
    "play.paused",
    [
      "Everything's frozen. Resume to keep going, Retry to start the run over, or Quit to leave it.",
      "In a longer run you can also retry just the current stage to practise it.",
    ],
  ],
  [
    "play.continue",
    [
      "Out of lives! Continuing keeps you in the run, but your score goes back to zero. Giving up ends the run with the score you have.",
    ],
  ],
  [
    "play.results",
    [
      "That's the run! Here's how it went: score, grazes, bombs and time.",
      "Press R to try again right away, Ctrl + C to copy your result, or Esc to go back.",
    ],
  ],
  [
    "customise",
    [
      "This is your sketchbook. Each drawing is a small pixel sprite the game really uses.",
      "IN GAME is the ship you fly, DRONE is the little helper beside you, and MENU is the flyer that crosses the menu sky.",
      "Mirror keeps both halves even while you draw. You can also drop an image here to trace over it.",
    ],
  ],
  [
    "gallery",
    [
      "Welcome to CREATE! Every card here is something you can build: stages, enemies, patterns, effects, visuals, audio and story.",
      "Click the plus to be dealt a hand of starting cards, then pick the kind you want to make.",
      "Open a card to edit it. You can rename, duplicate, export or delete cards. Drop a card file here to import someone else's.",
    ],
  ],
  [
    "gallery.stage",
    [
      "Stages are the levels you play. Runs chain stages together, and games bundle a run for each difficulty.",
      "The gems on a card show its tier: one for a stage, two for a run, and more for a full game.",
    ],
  ],
  [
    "gallery.enemy",
    [
      "Enemies are the ships you fight. Regular ones have one health bar, sub-bosses show up mid-stage, and bosses fight through several spell bars.",
      "The gems on a card show how tough its rank is.",
    ],
  ],
  [
    "gallery.pattern",
    [
      "Patterns are how enemies shoot. Objective patterns fire at the field, subjective ones fire from the enemy itself.",
      "Spells are boss attacks: a pattern dressed up with its own sigil, sky and declare sound.",
    ],
  ],
  [
    "gallery.effect",
    [
      "Effects are the power-ups and curses enemies drop. Lasting ones run for a while, special ones are shields, auras and curses, and instant ones happen at once.",
    ],
  ],
  [
    "gallery.visual",
    [
      "Visuals dress up your stages: scrolling skies, the frame around play, menu palettes, bullet looks, enemy craft and spell sigils.",
    ],
  ],
  [
    "gallery.audio",
    [
      "Audio cards are sound effects, songs and ambience, plus OSTs that collect songs for a game.",
      "Every sound in this game is a card like these, even the menu sounds!",
    ],
  ],
  [
    "gallery.story",
    [
      "Story cards hold your characters and the cutscenes they talk in. Stages can play a cutscene at any keyframe.",
    ],
  ],
  [
    "gallery.deal",
    [
      "Pick a card from the hand to start a new creation of that kind. You can change everything about it afterwards.",
    ],
  ],
  [
    "editor",
    [
      "This is the editor. The controls are on one side and the live preview on the other, so every change shows up straight away.",
      "Roll a section's dice to randomise just that part. The percentage beside a section shows how much of the card uses it.",
      "Press P to playtest, Shift + P to watch the autopilot, and Ctrl + Z if you change your mind.",
    ],
  ],
  [
    "editor.stage",
    [
      "A stage is a timeline. Add keyframes, and each keyframe sends in enemies or plays a cutscene.",
      "Each spawn chooses an enemy, how many come and the gap between them. Effects can apply to you or to the enemies.",
      "Up top you choose the sky, frame, palette, music and the stage's difficulty.",
    ],
  ],
  [
    "editor.run",
    [
      "A run is stages played in a row at one difficulty. Add stages and put them in the order you like.",
    ],
  ],
  [
    "editor.game",
    [
      "A game bundles a run for each difficulty. Give it an OST and choose the scores that award an extra life.",
    ],
  ],
  [
    "editor.enemy",
    [
      "Pick a craft, colour and size, then set the rank: regular, sub-boss or boss.",
      "Combat is split into stages. Each one has its own health, time limit and attack, which can be a pattern or a full spell.",
      "Drops decide what falls when the enemy is beaten, including any effects.",
    ],
  ],
  [
    "editor.pattern",
    [
      "Build a pattern from top to bottom: what the bullets look like, where they aim, how they spread, where the gaps are and how fast they fire.",
      "Gaps leave holes in a volley. Without them some patterns are impossible to dodge!",
    ],
  ],
  [
    "editor.spell",
    [
      "A spell is a boss's named attack. Choose its pattern, the sigil that spins behind the boss, a sky and the sound when it's declared.",
    ],
  ],
  [
    "editor.effect",
    [
      "Effects are what enemies drop. The mode decides how it behaves: timed, instant, shield, stacking, curse, aura, ramp or focus only.",
      "Modifiers change fire rate, bullet speed, move speed or damage. Who they affect is set on each stage spawn.",
      "World changes bend the whole stage: freezing bullets, mirrored volleys, fog, wind or recoloured shots.",
    ],
  ],
  [
    "editor.background",
    [
      "A background is a scrolling sky. Stack layers, add scenery, and set how fast each layer scrolls and drifts.",
    ],
  ],
  [
    "editor.wallpaper",
    [
      "The wallpaper is the frame around the play area. Choose the colours and a repeating motif.",
    ],
  ],
  [
    "editor.bullet",
    [
      "Shape an energy shot: its outline, length, glow and core. Patterns pick a bullet to fire.",
    ],
  ],
  [
    "editor.vessel",
    [
      "Build an enemy craft from a hull, wings, engines and guns, then paint it. Enemies pick a vessel to fly.",
    ],
  ],
  [
    "editor.palette",
    [
      "A palette recolours the menus: the accent, highlight, text and labels. Stages can bring their own.",
    ],
  ],
  [
    "editor.sigil",
    [
      "A sigil is the set of rings that spins behind a boss during a spell. Add rings and give each one a shape and motion.",
    ],
  ],
  [
    "editor.sound",
    [
      "A sound can be a synth tone, an imported file, a song you compose, or a generated ambience.",
      "Synth tones are great for shots and pickups. Songs open the composer, where you write music on a grid.",
    ],
  ],
  [
    "editor.ost",
    [
      "An OST is a game's soundtrack. Each track pairs a song with a sky and a frame, and Zen uses these too.",
    ],
  ],
  [
    "editor.character",
    [
      "A character speaks in cutscenes. Give them a name colour and a sprite for each emotion.",
    ],
  ],
  [
    "editor.cutscene",
    [
      "A cutscene is a conversation. Choose a background and write the transcript, line by line.",
    ],
  ],
  [
    "editor.composer",
    [
      "This is the composer. Write patterns on the grid, then lay them out on the tracks to build a song.",
    ],
  ],
  [
    "editor.painter",
    [
      "Paint over your vessel here, pixel by pixel. Whatever you draw is used in game.",
    ],
  ],
  [
    "config",
    [
      "All the settings live here, in sections: visual, display, gameplay, create, controls and audio. Q and E flip between them.",
      "Rebind any key under controls. Turn on always show hitbox if you like seeing it without focusing.",
    ],
  ],
  [
    "stats",
    [
      "Your records live here: play time, runs, grazes and more.",
      "Browse the achievements below. Even a locked one tells you how to earn it.",
    ],
  ],
]);

function lessonFor(subject: string): Array<string> {
  return (
    lessons.get(subject) ??
    lessons.get(subject.split(".")[0] ?? "") ??
    new Array()
  );
}

export { lessonFor };
