/**
 * Sound recipes for Blurt!. Every sound here is synthesized from scratch (oscillators, filtered
 * noise, envelopes), so the output is original and owned by the project (dedicated to CC0).
 *
 * Each recipe gets its own seeded PRNG so regeneration is deterministic.
 */
import {
  bandpass,
  biquad,
  concat,
  crush,
  drive,
  echo,
  env,
  expDecay,
  gain,
  gate,
  glide,
  highpass,
  lowpass,
  mix,
  noise,
  note,
  osc,
  partials,
  pluck,
  reverb,
  ringMod,
  samples,
  sequence,
  shape,
  silence,
  varispeed,
  SR,
  type Buf,
  type Signal,
} from './dsp';

export type SoundKind = 'buzzer' | 'tick' | 'sfx';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  kind: SoundKind;
  render(r: () => number): Buf;
}

// ---------------------------------------------------------------- shared voices

/** Reed-style horn: stacked detuned saws with a pitch scoop, driven hard. */
function horn(sec: number, freqs: number[], r: () => number, scoop = 0.08): Buf {
  const voices = freqs.flatMap((f) =>
    [-0.35, 0.35].map((cents) => {
      const det = Math.pow(2, (cents * (0.8 + r() * 0.4)) / 100);
      return osc(
        'saw',
        (t) => f * det * (1 - scoop * Math.exp(-t / 0.03)) * (1 - 0.02 * Math.max(0, t - sec + 0.15)),
        sec,
        {
          phase: r(),
        },
      );
    }),
  );
  let b = mix(...voices);
  b = biquad(b, 'peak', 1800, 1.2, 8);
  b = lowpass(b, 5200);
  b = drive(gain(b, 0.6), 3);
  const air = bandpass(noise(sec, r), 2400, 1.5);
  return shape(mix(b, [air, 0.05]), gate(sec, 0.015, 0.06));
}

/** Brassy saw voice whose brightness follows the amplitude envelope (gives the "wah"). */
function brass(sec: number, freq: Signal, r: () => number, amp: (t: number) => number, bright = 2600): Buf {
  const f = (t: number) => (typeof freq === 'number' ? freq : freq(t));
  const a = osc('saw', (t) => f(t) * 1.003, sec, { phase: r() });
  const b = osc('saw', (t) => f(t) * 0.997, sec, { phase: r() });
  const c = osc('square', (t) => f(t) * 0.5, sec, { phase: r() });
  const raw = mix([a, 0.5], [b, 0.5], [c, 0.25]);
  const filtered = lowpass(raw, (t) => 250 + bright * amp(t), 1.4);
  return shape(drive(filtered, 1.8), amp);
}

/** Flute/whistle tone: sine plus a hint of 2nd harmonic and pitched breath noise. */
function whistle(sec: number, freq: (t: number) => number, r: () => number, breath = 0.18): Buf {
  const tone = mix(osc('sine', freq, sec), [osc('sine', (t) => freq(t) * 2, sec), 0.12]);
  const air = bandpass(noise(sec, r), freq, 6);
  return mix(tone, [air, breath * 4]);
}

/** Struck metal: partials with a click. */
function bell(sec: number, base: number, ratios: [number, number, number][], r: () => number, click = 0.4): Buf {
  const body = partials(
    base,
    ratios.map(([ratio, amp, decay]) => ({ ratio: ratio * (1 + (r() - 0.5) * 0.004), amp, decay })),
    sec,
  );
  const hit = shape(highpass(noise(sec, r), 3000), expDecay(0.004));
  return mix(body, [hit, click]);
}

/** Saw-ensemble chord stab (strings + brass). */
function chordStab(sec: number, freqs: number[], r: () => number, amp: (t: number) => number, cutoff = 1800): Buf {
  const voices = freqs.flatMap((f) =>
    [-7, 0, 7].map((c) => osc('saw', f * Math.pow(2, (c + (r() - 0.5) * 3) / 1200), sec, { phase: r() })),
  );
  const raw = gain(mix(...voices), 1 / voices.length);
  return shape(
    drive(
      lowpass(raw, (t) => 300 + cutoff * amp(t), 0.9),
      2,
    ),
    amp,
  );
}

/** Timpani/tom hit: pitch-dropping sine plus thud noise. */
function drum(sec: number, from: number, to: number, decay: number, r: () => number, snap = 0.3): Buf {
  const body = shape(osc('sine', glide(from, to, decay * 1.5), sec), expDecay(decay));
  const thud = shape(lowpass(noise(sec, r), 1800), expDecay(0.03));
  return mix(body, [thud, snap]);
}

/** Filtered noise explosion. */
function boom(sec: number, r: () => number, size = 1): Buf {
  const rumble = shape(lowpass(noise(sec, r), glide(7000, 180, sec * 0.8), 0.9), expDecay(0.35 * size));
  const thump = shape(osc('sine', glide(110, 32, 0.4), sec), expDecay(0.22 * size));
  const crackle = silence(sec);
  for (let i = 0; i < 70 * size; i++) {
    const start = samples(Math.pow(r(), 1.6) * sec * 0.7);
    const len = samples(0.002 + r() * 0.006);
    const amp = (1 - start / crackle.length) * (0.4 + r() * 0.6);
    for (let j = 0; j < len && start + j < crackle.length; j++) crackle[start + j] += (r() * 2 - 1) * amp;
  }
  return reverb(drive(mix([rumble, 1.1], [thump, 0.9], [highpass(crackle, 1500), 0.5]), 2.5), 0.6, 0.18, 0.2);
}

/** Squeaky rubber / balloon voice with fluttering amplitude. */
function squeal(sec: number, freq: (t: number) => number, r: () => number, flutter = 40): Buf {
  let jitter = 0;
  const jit = new Float32Array(samples(sec));
  for (let i = 0; i < jit.length; i++) {
    if (i % 200 === 0) jitter = (r() - 0.5) * 0.04;
    jit[i] = jitter;
  }
  const tone = osc('saw', (t) => freq(t) * (1 + jit[Math.min(jit.length - 1, Math.floor(t * SR))]), sec, {
    phase: r(),
  });
  const nasal = mix([bandpass(tone, (t) => freq(t) * 2.2, 3), 1], [bandpass(tone, 2600, 2), 0.7]);
  return drive(
    shape(nasal, (t) => 0.75 + 0.25 * Math.sin(2 * Math.PI * flutter * t)),
    2.5,
  );
}

const N = note;

// ---------------------------------------------------------------- buzzers

export const BUZZERS: Recipe[] = [
  {
    id: 'air-horn',
    name: 'Air Horn',
    description: 'One long, brassy stadium air-horn blast built from detuned sawtooth reeds.',
    kind: 'buzzer',
    render: (r) => horn(1.3, [330, 415, 494], r),
  },
  {
    id: 'triple-horn',
    name: 'Triple Air Horn',
    description: 'Three rapid air-horn blasts, the last one long.',
    kind: 'buzzer',
    render: (r) =>
      sequence(1.35, [
        [horn(0.2, [523, 659], r, 0.12), 0],
        [horn(0.2, [523, 659], r, 0.12), 0.26],
        [horn(0.8, [523, 659], r, 0.12), 0.52],
      ]),
  },
  {
    id: 'game-show',
    name: 'Wrong Answer Buzzer',
    description: 'Harsh low game-show "ehhhh" buzzer: beating square waves through heavy drive.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.0;
      const b = mix(osc('square', 98, sec, { phase: r() }), osc('square', 104, sec, { phase: r() }), [
        osc('saw', 196, sec),
        0.6,
      ]);
      return shape(drive(lowpass(b, 2600), 4), gate(sec, 0.008, 0.04));
    },
  },
  {
    id: 'klaxon',
    name: 'Klaxon',
    description: 'Old-car "a-woo-ga" klaxon, twice: a rising then falling nasal sawtooth.',
    kind: 'buzzer',
    render: (r) => {
      const one = () => {
        const sec = 0.62;
        const f = env([
          [0, 190],
          [0.3, 420],
          [0.42, 430],
          [0.62, 320],
        ]);
        const tone = osc('saw', f, sec, { phase: r() });
        const formant = mix(
          bandpass(tone, (t) => f(t) * 3, 2.5),
          [lowpass(tone, 1500), 0.6],
        );
        return shape(drive(ringMod(formant, 70, 0.25), 3), gate(sec, 0.02, 0.06));
      };
      return concat(one(), silence(0.06), one());
    },
  },
  {
    id: 'sad-trombone',
    name: 'Sad Trombone',
    description: 'Four descending "wah" notes, the last one long and wobbly.',
    kind: 'buzzer',
    render: (r) => {
      const notes: [number, number][] = [
        [N('D4'), 0.32],
        [N('C#4'), 0.32],
        [N('C4'), 0.32],
        [N('B3'), 0.95],
      ];
      const clips = notes.map(([f, sec], i) => {
        const last = i === notes.length - 1;
        const vib = (t: number) => (last ? 1 + 0.018 * Math.min(1, t / 0.3) * Math.sin(2 * Math.PI * 6 * t) : 1);
        const amp = last
          ? env([
              [0, 0],
              [0.05, 1],
              [0.6, 0.8],
              [sec, 0],
            ])
          : env([
              [0, 0],
              [0.06, 1],
              [0.2, 0.85],
              [sec, 0],
            ]);
        return brass(sec, (t) => f * vib(t) * (1 - 0.02 * Math.exp(-t / 0.04)), r, amp, 3200);
      });
      return concat(...clips);
    },
  },
  {
    id: 'boing',
    name: 'Boing',
    description: 'Cartoon spring boing: a sine whose pitch wobbles and droops as it decays.',
    kind: 'buzzer',
    render: () => {
      const sec = 1.1;
      const f = (t: number) =>
        (230 - 70 * Math.min(1, t)) * (1 + 0.35 * Math.exp(-t * 2.6) * Math.sin(2 * Math.PI * 9 * t));
      const tone = mix(
        osc('sine', f, sec),
        [osc('sine', (t) => f(t) * 2, sec), 0.35],
        [osc('triangle', (t) => f(t) * 3, sec), 0.1],
      );
      return shape(drive(tone, 1.5), expDecay(0.45, 0.004));
    },
  },
  {
    id: 'slide-whistle',
    name: 'Slide Whistle',
    description: 'A quick "fwee" up, then a long slide-whistle dive down.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.35;
      const f = (t: number) =>
        (t < 0.12
          ? 1500 * Math.pow(2300 / 1500, t / 0.12)
          : 2300 * Math.pow(330 / 2300, Math.pow((t - 0.12) / 1.15, 0.8))) *
        (1 + 0.02 * Math.sin(2 * Math.PI * 5.5 * t));
      return shape(whistle(sec, f, r), gate(sec, 0.03, 0.12));
    },
  },
  {
    id: 'kaboom',
    name: 'Kaboom',
    description: 'Explosion: a noise burst with sweeping low-pass, sub thump and crackle.',
    kind: 'buzzer',
    render: (r) => boom(1.8, r, 1.2),
  },
  {
    id: 'laser',
    name: 'Laser Blaster',
    description: 'Three sci-fi "pew" zaps with fast exponential pitch drops.',
    kind: 'buzzer',
    render: (r) => {
      const zap = (sec: number, top: number, rate: number) => {
        const f = (t: number) => top * Math.exp(-t * rate) + 160;
        const fm = osc('sine', (t) => f(t) * (1 + 0.3 * Math.sin(2 * Math.PI * 55 * t)), sec);
        return shape(mix(fm, [osc('square', f, sec, { phase: r() }), 0.4]), expDecay(sec * 0.45, 0.002));
      };
      return drive(
        sequence(1.0, [
          [zap(0.22, 2800, 14), 0],
          [zap(0.22, 2600, 14), 0.2],
          [zap(0.5, 3200, 7), 0.42],
        ]),
        1.8,
      );
    },
  },
  {
    id: 'robot-error',
    name: 'Robot Error',
    description: 'Random computer bleeps, then a crushed, ring-modulated "bzzt".',
    kind: 'buzzer',
    render: (r) => {
      const steps = Array.from({ length: 8 }, () => 300 + Math.floor(r() * 12) * 110);
      const bleeps = osc('square', (t) => steps[Math.min(7, Math.floor(t / 0.06))], 0.48);
      const bz = shape(
        osc('saw', 72, 0.65, { phase: r() }),
        (t) => (Math.sin(2 * Math.PI * 16 * t) > -0.2 ? 1 : 0.15) * gate(0.65, 0.01, 0.1)(t),
      );
      const b = concat(shape(bleeps, gate(0.48, 0.003, 0.01)), silence(0.05), drive(bz, 3));
      return crush(ringMod(b, 47, 0.35), 6, 3);
    },
  },
  {
    id: 'siren',
    name: 'Siren',
    description: 'Two cycles of a rising and falling emergency siren wail.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.7;
      const f = (t: number) => 620 + 700 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 0.85));
      const b = mix([osc('saw', f, sec, { phase: r() }), 0.6], osc('sine', f, sec), [
        osc('square', (t) => f(t) * 1.5, sec),
        0.15,
      ]);
      return shape(drive(lowpass(b, 3500), 2), gate(sec, 0.04, 0.1));
    },
  },
  {
    id: 'alarm-bell',
    name: 'Alarm Bell',
    description: 'A school-style alarm bell ringing hard with a rapid clapper.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.6;
      const ringFor = 1.25;
      const strike = bell(
        0.3,
        1650,
        [
          [1, 1, 0.12],
          [2.32, 0.6, 0.08],
          [4.25, 0.35, 0.05],
          [6.63, 0.2, 0.03],
        ],
        r,
        0.5,
      );
      const events: [Buf, number, number?][] = [];
      for (let t = 0; t < ringFor; t += 1 / 24) events.push([strike, t, 0.55 + r() * 0.35]);
      const tail = bell(
        0.6,
        1650,
        [
          [1, 1, 0.25],
          [2.32, 0.5, 0.15],
        ],
        r,
      );
      events.push([tail, ringFor]);
      return drive(sequence(sec, events), 2);
    },
  },
  {
    id: 'fog-horn',
    name: 'Fog Horn',
    description: 'A deep, slow ship fog horn that ends in a low grunt.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.9;
      const f = (t: number) => (t < 1.4 ? 138 : 138 * Math.pow(0.68, Math.min(1, (t - 1.4) / 0.15)));
      const b = mix(osc('saw', f, sec, { phase: r() }), [osc('pulse', (t) => f(t) * 1.005, sec, { pw: 0.3 }), 0.8]);
      const body = shape(
        drive(lowpass(b, 1400, 1.3), 2.5),
        env([
          [0, 0],
          [0.18, 1],
          [1.4, 0.95],
          [1.5, 1],
          [sec, 0],
        ]),
      );
      return reverb(body, 0.8, 0.3, 0.1);
    },
  },
  {
    id: 'gong',
    name: 'Big Gong',
    description: 'A huge shimmering gong with blooming inharmonic partials.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 2.0;
      const ratios = [1, 1.52, 2.03, 2.47, 2.92, 3.53, 4.08, 5.3, 6.11, 7.2];
      const body = partials(
        (t) => 120 * (1 - 0.01 * Math.min(1, t)),
        ratios.map((ratio, i) => ({
          ratio: ratio * (1 + (r() - 0.5) * 0.01),
          amp: 1 / (1 + i * 0.35),
          decay: 1.4 - i * 0.08,
          attack: 0.003 + i * 0.04,
        })),
        sec,
      );
      const mallet = shape(lowpass(noise(sec, r), 900), expDecay(0.03));
      return reverb(drive(mix(body, [mallet, 0.8]), 2.2), 0.7, 0.25, 0.1);
    },
  },
  {
    id: 'cymbal-crash',
    name: 'Cymbal Crash',
    description: 'A bright crash cymbal: metallic square clusters plus high noise.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.7;
      const metal = mix(
        ...[205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => osc('square', f * 1.7, sec, { phase: r() })),
      );
      const hiss = noise(sec, r);
      const b = mix([highpass(bandpass(metal, 7000, 0.6), 4000), 0.5], [highpass(hiss, 3500), 1]);
      const ampEnv = (t: number) => 0.6 * Math.exp(-t / 0.08) + 0.5 * Math.exp(-t / 0.55);
      return reverb(shape(b, ampEnv), 0.6, 0.2, 0.1);
    },
  },
  {
    id: 'kazoo',
    name: 'Kazoo Taunt',
    description: 'A buzzy kazoo playing a teasing "nyah-nyah" phrase.',
    kind: 'buzzer',
    render: (r) => {
      const notes: [string, number][] = [
        ['G4', 0.2],
        ['E4', 0.2],
        ['A4', 0.2],
        ['G4', 0.2],
        ['E4', 0.5],
      ];
      const starts: number[] = [];
      let acc = 0;
      for (const [, d] of notes) {
        starts.push(acc);
        acc += d;
      }
      const sec = acc;
      const target = (t: number) => {
        let k = 0;
        while (k < starts.length - 1 && t >= starts[k + 1]) k++;
        const prev = N(notes[Math.max(0, k - 1)][0]);
        const cur = N(notes[k][0]);
        const p = Math.min(1, (t - starts[k]) / 0.03);
        return (prev + (cur - prev) * p) * (1 + 0.012 * Math.sin(2 * Math.PI * 6.5 * t));
      };
      const tone = osc('saw', target, sec, { phase: r() });
      const buzz = shape(tone, () => 1 + (r() - 0.5) * 0.6);
      const formants = mix([bandpass(buzz, 650, 3), 1], [bandpass(buzz, 1300, 4), 0.8], [bandpass(buzz, 2700, 5), 0.5]);
      const amp = (t: number) => {
        let k = 0;
        while (k < starts.length - 1 && t >= starts[k + 1]) k++;
        return gate(notes[k][1], 0.015, 0.04)(t - starts[k]);
      };
      return shape(drive(formants, 3), amp);
    },
  },
  {
    id: 'chip-fail',
    name: '8-Bit Game Over',
    description: 'A chiptune descending arpeggio ending on a low wobbling note.',
    kind: 'buzzer',
    render: () => {
      const notes: [string, number][] = [
        ['G5', 0.11],
        ['D#5', 0.11],
        ['C5', 0.11],
        ['G4', 0.11],
        ['C4', 0.5],
      ];
      const clips = notes.map(([n, sec], i) => {
        const last = i === notes.length - 1;
        const f = (t: number) => N(n) * (last ? 1 + 0.03 * Math.sin(2 * Math.PI * 9 * t) : 1);
        return shape(osc('pulse', f, sec, { pw: last ? 0.5 : 0.25 }), gate(sec, 0.002, last ? 0.12 : 0.01));
      });
      return crush(concat(...clips), 5, 4);
    },
  },
  {
    id: 'chip-wipeout',
    name: '8-Bit Wipeout',
    description: 'A stepped chiptune pitch dive followed by a crunchy noise burst.',
    kind: 'buzzer',
    render: () => {
      const dive = osc(
        'pulse',
        (t) => {
          const semis = Math.floor(t / 0.035) * 1.6;
          return 1400 * Math.pow(2, -semis / 12) * (Math.floor(t * 30) % 2 ? 1 : 1.5);
        },
        0.75,
        { pw: 0.125 },
      );
      let lfsr = 0x7fff;
      let held = 0;
      const crunch = silence(0.4);
      for (let i = 0; i < crunch.length; i++) {
        if (i % 12 === 0) {
          const bit = (lfsr ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (bit << 14);
          held = lfsr & 1 ? 1 : -1;
        }
        crunch[i] = held * Math.exp(-i / SR / 0.15);
      }
      return crush(concat(shape(dive, gate(0.75, 0.002, 0.02)), crunch), 5, 3);
    },
  },
  {
    id: 'clown-horn',
    name: 'Clown Honk',
    description: 'A squeezy bulb horn: honk, honk, HONK.',
    kind: 'buzzer',
    render: (r) => {
      const honk = (sec: number, f: number) => {
        const tone = osc('saw', (t) => f * (0.78 + 0.22 * (1 - Math.exp(-t / 0.025))), sec, { phase: r() });
        const body = mix([bandpass(tone, 1100, 2), 1], [bandpass(tone, 2600, 3), 0.6], [lowpass(tone, 600), 0.4]);
        return shape(drive(ringMod(body, 31, 0.2), 4), gate(sec, 0.01, 0.05));
      };
      return sequence(1.15, [
        [honk(0.2, 370), 0],
        [honk(0.2, 370), 0.28],
        [honk(0.5, 330), 0.6],
      ]);
    },
  },
  {
    id: 'rubber-chicken',
    name: 'Rubber Chicken',
    description: 'A squawking rubber chicken: a rising then falling nasal squeal.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.1;
      const f = env([
        [0, 700],
        [0.1, 1350],
        [0.35, 1250],
        [sec, 560],
      ]);
      const wheeze = shape(bandpass(noise(sec, r), 3000, 2), expDecay(0.08));
      return shape(mix(squeal(sec, f, r, 23), [wheeze, 0.4]), gate(sec, 0.02, 0.15));
    },
  },
  {
    id: 'zapped',
    name: 'Zapped',
    description: 'An electric shock: crackling mains buzz with random sparks.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.2;
      const hum = mix(osc('saw', 120, sec, { phase: r() }), [osc('square', 180, sec), 0.5]);
      const sparks = shape(highpass(noise(sec, r), 2000), () => (r() < 0.06 ? 1 : 0.15));
      let g = 1;
      const gates = shape(silence(sec).fill(1), (t) => {
        if (Math.floor(t * SR) % 600 === 0) g = r() < 0.75 ? 1 : 0.2;
        return g;
      });
      const b = mix([bandpass(hum, 1600, 0.7), 1.2], [sparks, 0.6]);
      return crush(
        shape(
          drive(ringMod(b, 50, 0.6), 4),
          (t) => gates[Math.min(gates.length - 1, Math.floor(t * SR))] * gate(sec, 0.005, 0.1)(t),
        ),
        7,
        2,
      );
    },
  },
  {
    id: 'raspberry',
    name: 'Raspberry',
    description: 'A rude, flappy blown raspberry.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.2;
      let jit = 0;
      const f = (t: number) => {
        if (Math.floor(t * SR) % 400 === 0) jit = (r() - 0.5) * 12;
        return 115 - 30 * t + jit;
      };
      const tone = osc('saw', f, sec, { phase: r() });
      const flap = (t: number) => (Math.sin(2 * Math.PI * (26 + 4 * Math.sin(2 * Math.PI * 3 * t)) * t) > 0 ? 1 : 0.35);
      const body = mix([lowpass(tone, (t) => 2200 - 900 * t, 1.5), 1], [bandpass(noise(sec, r), 900, 1), 0.35]);
      return shape(
        drive(shape(body, flap), 3),
        env([
          [0, 0],
          [0.08, 1],
          [0.9, 0.85],
          [sec, 0],
        ]),
      );
    },
  },
  {
    id: 'ba-dum-tss',
    name: 'Ba-Dum-Tss',
    description: 'A comedy rimshot: two tom hits and a sizzling cymbal.',
    kind: 'buzzer',
    render: (r) => {
      const snare = (f: number) =>
        mix(drum(0.4, f * 1.4, f, 0.12, r, 0.4), [shape(highpass(noise(0.4, r), 1500), expDecay(0.06)), 0.6]);
      const hat = shape(highpass(noise(1.0, r), 6500), (t) => 0.8 * Math.exp(-t / 0.45));
      const kick = drum(0.5, 140, 50, 0.18, r, 0.5);
      return drive(
        sequence(1.25, [
          [snare(200), 0],
          [snare(150), 0.2],
          [kick, 0.42],
          [hat, 0.42],
          [snare(240), 0.42, 0.5],
        ]),
        2,
      );
    },
  },
  {
    id: 'cuckoo',
    name: 'Cuckoo Clock',
    description: 'A wooden clack and two "cuck-oo" calls from a cuckoo clock.',
    kind: 'buzzer',
    render: (r) => {
      const call = (f: number, sec: number) =>
        shape(
          whistle(sec, () => f, r, 0.05),
          gate(sec, 0.01, 0.06),
        );
      const cuckoo = concat(call(N('D6'), 0.17), silence(0.04), call(N('A#5'), 0.3));
      const clack = shape(bandpass(noise(0.08, r), 1800, 4), expDecay(0.01));
      return drive(
        sequence(1.4, [
          [clack, 0],
          [cuckoo, 0.08],
          [clack, 0.6],
          [cuckoo, 0.68],
        ]),
        1.6,
      );
    },
  },
  {
    id: 'ufo',
    name: 'UFO Warble',
    description: 'A descending flying-saucer warble with metallic ring modulation and echo.',
    kind: 'buzzer',
    render: () => {
      const sec = 1.5;
      const center = glide(1500, 260, sec);
      const tone = osc('triangle', (t) => center(t) * (1 + 0.16 * Math.sin(2 * Math.PI * 11 * t)), sec);
      const metal = ringMod(tone, 333, 0.4);
      return echo(shape(drive(metal, 2), gate(sec, 0.02, 0.2)), 0.11, 0.35, 0.4, 0.25);
    },
  },
  {
    id: 'record-scratch',
    name: 'Record Scratch',
    description: 'A DJ "wikka-wikka" record scratch over a stopped beat.',
    kind: 'buzzer',
    render: (r) => {
      const src = mix(
        osc('saw', N('C4'), 1.2, { phase: r() }),
        osc('saw', N('E4'), 1.2, { phase: r() }),
        osc('saw', N('G4'), 1.2, { phase: r() }),
        [shape(lowpass(noise(1.2, r), 4000), (t) => Math.exp(-((t * 4) % 1) * 6)), 1.5],
      );
      const sec = 0.85;
      const rate = (t: number) => (t < 0.62 ? 3.2 * Math.sin(2 * Math.PI * 4.8 * t) : 0);
      const scratched = varispeed(src, rate, sec, 0.3);
      const hiss = shape(
        bandpass(noise(sec, r), (t) => 500 + (3500 * Math.abs(rate(t))) / 3.2, 2),
        (t) => Math.abs(rate(t)) / 3.2,
      );
      return shape(drive(mix(scratched, [hiss, 0.8]), 2.2), gate(sec, 0.005, 0.1));
    },
  },
  {
    id: 'power-down',
    name: 'Power Down',
    description: 'A chord that grinds to a halt like a tape stop or dying robot.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.4;
      const curve = (t: number) => Math.pow(Math.max(0, 1 - t / sec), 1.8);
      const voices = ['C4', 'E4', 'G4', 'C5'].map((n) => osc('saw', (t) => N(n) * curve(t) + 18, sec, { phase: r() }));
      const b = lowpass(mix(...voices), (t) => 300 + 4000 * curve(t), 1.2);
      return shape(drive(b, 2), (t) => Math.min(1, t / 0.01) * Math.min(1, (sec - t) / 0.4));
    },
  },
  {
    id: 'shatter',
    name: 'Glass Shatter',
    description: 'A sharp crack followed by a shower of tinkling shards.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.3;
      const crack = shape(highpass(noise(sec, r), 1800), (t) => Math.exp(-t / 0.05));
      const events: [Buf, number, number?][] = [[crack, 0, 1.3]];
      for (let i = 0; i < 55; i++) {
        const start = Math.pow(r(), 1.8) * 1.0;
        const f = 2200 + r() * 5500;
        const ping = partials(
          f,
          [
            { ratio: 1, amp: 1, decay: 0.04 + r() * 0.12 },
            { ratio: 2.7, amp: 0.3, decay: 0.03 },
          ],
          0.3,
        );
        events.push([ping, start, (0.25 + r() * 0.45) * (1 - start * 0.6)]);
      }
      return drive(sequence(sec, events), 1.8);
    },
  },
  {
    id: 'whistle',
    name: 'Referee Whistle',
    description: 'A trilling pea whistle: tweet, tweet, tweeeeet!',
    kind: 'buzzer',
    render: (r) => {
      const blast = (sec: number) => {
        const trill = (t: number) => Math.sin(2 * Math.PI * 27 * t);
        const tone = whistle(sec, (t) => 2900 * (1 + 0.035 * trill(t)), r, 0.3);
        return shape(tone, (t) => (0.75 + 0.25 * trill(t)) * gate(sec, 0.012, 0.04)(t));
      };
      return drive(
        sequence(1.2, [
          [blast(0.14), 0],
          [blast(0.14), 0.22],
          [blast(0.7), 0.44],
        ]),
        2,
      );
    },
  },
  {
    id: 'cowbell',
    name: 'More Cowbell',
    description: 'A clanky drum-machine cowbell rhythm.',
    kind: 'buzzer',
    render: (r) => {
      const hit = () => {
        const sec = 0.4;
        const b = mix(osc('square', 562, sec, { phase: r() }), osc('square', 845, sec, { phase: r() }));
        return shape(bandpass(b, 1100, 1.2), (t) => 0.8 * Math.exp(-t / 0.015) + 0.5 * Math.exp(-t / 0.12));
      };
      return drive(
        sequence(1.1, [
          [hit(), 0, 0.8],
          [hit(), 0.15, 0.7],
          [hit(), 0.3, 0.8],
          [hit(), 0.6, 1.1],
        ]),
        2.5,
      );
    },
  },
  {
    id: 'boxing-bell',
    name: 'Ding Ding Ding',
    description: 'A boxing-ring bell struck three times.',
    kind: 'buzzer',
    render: (r) => {
      const strike = () =>
        bell(
          1.2,
          980,
          [
            [1, 1, 0.6],
            [2.76, 0.55, 0.35],
            [5.4, 0.3, 0.18],
            [8.93, 0.15, 0.08],
          ],
          r,
          0.6,
        );
      return drive(
        sequence(1.65, [
          [strike(), 0],
          [strike(), 0.22, 0.95],
          [strike(), 0.44, 1],
        ]),
        2,
      );
    },
  },
  {
    id: 'dun-dun-dun',
    name: 'Dramatic Sting',
    description: 'Orchestral "dun, dun, DUNNN" stabs with timpani.',
    kind: 'buzzer',
    render: (r) => {
      const minor = [N('C3'), N('G3'), N('C4'), N('D#4')];
      const final = [N('G#2'), N('D#3'), N('G#3'), N('C4')];
      const stab = (freqs: number[], sec: number) =>
        chordStab(
          sec,
          freqs,
          r,
          env([
            [0, 0],
            [0.01, 1],
            [0.08, 0.7],
            [sec, 0],
          ]),
        );
      const long = chordStab(
        1.2,
        final,
        r,
        (t) => Math.min(1, t / 0.01) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 7 * t)) * Math.min(1, (1.2 - t) / 0.5),
        2200,
      );
      const timp = (f: number) => drum(0.8, f * 1.15, f, 0.35, r, 0.5);
      return drive(
        sequence(1.75, [
          [stab(minor, 0.22), 0],
          [timp(65), 0],
          [stab(minor, 0.22), 0.26],
          [timp(65), 0.26],
          [long, 0.54],
          [timp(52), 0.54, 1.2],
        ]),
        1.8,
      );
    },
  },
  {
    id: 'bomb-beeper',
    name: 'Bomb Beeper',
    description: 'A ticking-bomb beeper speeding up into a short boom.',
    kind: 'buzzer',
    render: (r) => {
      const beep = (sec: number) => shape(osc('square', 1750, sec, { phase: r() }), gate(sec, 0.002, 0.005));
      const events: [Buf, number, number?][] = [];
      let t = 0;
      let gap = 0.2;
      while (t < 0.7) {
        events.push([beep(0.045), t, 0.5]);
        t += gap;
        gap *= 0.78;
      }
      events.push([beep(0.18), t + 0.02, 0.55]);
      events.push([boom(0.9, r, 0.7), t + 0.22, 1]);
      return sequence(t + 1.1, events);
    },
  },
  {
    id: 'balloon-pop',
    name: 'Balloon Pop',
    description: 'A sharp balloon pop and a squealing, fluttering deflate.',
    kind: 'buzzer',
    render: (r) => {
      const pop = mix(shape(highpass(noise(0.1, r), 800), expDecay(0.012)), [
        shape(osc('sine', 90, 0.1), expDecay(0.03)),
        0.6,
      ]);
      const deflate = shape(
        squeal(1.1, (t) => 640 - 300 * t + 40 * Math.sin(2 * Math.PI * 4 * t), r, 48),
        (t) => gate(1.1, 0.05, 0.25)(t),
      );
      return sequence(1.35, [
        [drive(pop, 3), 0],
        [deflate, 0.18, 0.8],
      ]);
    },
  },
  {
    id: 'jaw-harp',
    name: 'Jaw Harp',
    description: 'A twangy "boing-oing-oing" jaw harp with a sweeping resonance.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.3;
      const tone = osc('saw', 98, sec, { phase: r() });
      const sweep = (t: number) => 420 + 1500 * (0.5 - 0.5 * Math.cos(2 * Math.PI * 3.2 * t));
      const b = mix([bandpass(tone, sweep, 9), 2], [lowpass(tone, 400), 0.3]);
      const twang = shape(highpass(noise(sec, r), 2500), expDecay(0.01));
      return drive(shape(mix(b, [twang, 0.5]), expDecay(0.6, 0.003)), 2.5);
    },
  },
  {
    id: 'harp-plunge',
    name: 'Harp Plunge',
    description: 'A plucked whole-tone harp glissando tumbling down into a sour cluster.',
    kind: 'buzzer',
    render: (r) => {
      const events: [Buf, number, number?][] = [];
      const top = 72 + 12; // C6 as a MIDI-ish semitone index above C0
      for (let i = 0; i < 14; i++) {
        const semis = top - i * 2;
        const f = 16.3516 * Math.pow(2, semis / 12);
        events.push([pluck(f, 0.7, r, 0.994, 0.3), i * 0.06, 0.7]);
      }
      for (const n of ['C3', 'C#3', 'F#3']) events.push([pluck(N(n), 0.9, r, 0.997, 0.4), 0.9, 0.9]);
      return drive(sequence(1.7, events), 2);
    },
  },
  {
    id: 'pan-bonk',
    name: 'Frying Pan Bonk',
    description: 'A cartoon frying-pan bonk with a wobbly metallic ring.',
    kind: 'buzzer',
    render: (r) => {
      const sec = 1.1;
      const base = (t: number) => 520 * (1 - 0.04 * Math.exp(-t / 0.03)) * (1 + 0.012 * Math.sin(2 * Math.PI * 7 * t));
      const body = partials(
        base,
        [
          { ratio: 1, amp: 1, decay: 0.45 },
          { ratio: 1.71, amp: 0.7, decay: 0.3 },
          { ratio: 2.53, amp: 0.5, decay: 0.2 },
          { ratio: 3.62, amp: 0.35, decay: 0.12 },
          { ratio: 4.9, amp: 0.2, decay: 0.08 },
        ],
        sec,
      );
      const thunk = shape(lowpass(noise(sec, r), 1200), expDecay(0.02));
      return drive(mix(body, [thunk, 1]), 2.5);
    },
  },
  {
    id: 'car-horn',
    name: 'Car Horn',
    description: 'A two-tone car horn: beep, beeeeep.',
    kind: 'buzzer',
    render: (r) => {
      const toot = (sec: number) => {
        const b = mix(osc('square', 415, sec, { phase: r() }), osc('square', 523, sec, { phase: r() }), [
          osc('saw', 830, sec),
          0.3,
        ]);
        return shape(drive(lowpass(biquad(b, 'peak', 2400, 2, 9), 4500), 3), gate(sec, 0.01, 0.04));
      };
      return concat(toot(0.17), silence(0.09), toot(0.75));
    },
  },
  {
    id: 'sour-fanfare',
    name: 'Sour Fanfare',
    description: 'A proud trumpet fanfare whose last note droops badly out of tune.',
    kind: 'buzzer',
    render: (r) => {
      const notes: [number, number, boolean][] = [
        [N('C5'), 0.1, false],
        [N('C5'), 0.1, false],
        [N('C5'), 0.1, false],
        [N('G5'), 0.95, true],
      ];
      const clips = notes.map(([f, sec, sour]) => {
        const pitch = (t: number) =>
          sour ? f * Math.pow(2, (-2.5 * Math.max(0, t - 0.25)) / 12) * (1 + 0.025 * Math.sin(2 * Math.PI * 5 * t)) : f;
        const amp = sour
          ? env([
              [0, 0],
              [0.02, 1],
              [0.3, 0.9],
              [sec, 0],
            ])
          : env([
              [0, 0],
              [0.01, 1],
              [sec - 0.02, 0.8],
              [sec, 0],
            ]);
        return brass(sec, pitch, r, amp, 4500);
      });
      return concat(...clips);
    },
  },
];

// ---------------------------------------------------------------- ticks and UI sfx

function woodblock(f: number, r: () => number): Buf {
  const sec = 0.08;
  const body = partials(
    f,
    [
      { ratio: 1, amp: 1, decay: 0.014 },
      { ratio: 1.62, amp: 0.45, decay: 0.009 },
      { ratio: 2.9, amp: 0.2, decay: 0.005 },
    ],
    sec,
  );
  const click = shape(highpass(noise(sec, r), 4000), expDecay(0.0015));
  return mix(body, [click, 0.35]);
}

export const TICKS: Recipe[] = [
  {
    id: 'tick',
    name: 'Tick',
    description: 'Short, crisp high woodblock tick for the fuse.',
    kind: 'tick',
    render: (r) => woodblock(1950, r),
  },
  {
    id: 'tock',
    name: 'Tock',
    description: 'Short woodblock tock, a fourth lower than the tick.',
    kind: 'tick',
    render: (r) => woodblock(1460, r),
  },
];

export const SFX: Recipe[] = [
  {
    id: 'gotIt',
    name: 'Got It',
    description: 'Bright two-note "di-ding" chime for a correct guess.',
    kind: 'sfx',
    render: (r) => {
      const ding = (f: number) =>
        bell(
          0.45,
          f,
          [
            [1, 1, 0.22],
            [2, 0.35, 0.12],
            [3, 0.12, 0.06],
            [4.2, 0.08, 0.04],
          ],
          r,
          0.15,
        );
      return sequence(0.5, [
        [ding(N('E6')), 0],
        [ding(N('B6')), 0.06, 0.9],
      ]);
    },
  },
  {
    id: 'skip',
    name: 'Skip',
    description: 'Quick airy whoosh for skipping a phrase.',
    kind: 'sfx',
    render: (r) => {
      const sec = 0.38;
      const center = env([
        [0, 350],
        [0.2, 2800],
        [sec, 900],
      ]);
      const air = mix(
        [bandpass(noise(sec, r), center, 1.8), 1],
        [bandpass(noise(sec, r), (t) => center(t) * 1.6, 3), 0.4],
      );
      return shape(
        air,
        env([
          [0, 0],
          [0.17, 1],
          [sec, 0],
        ]),
      );
    },
  },
  {
    id: 'point',
    name: 'Point',
    description: 'Sparkly rising three-note "+1" glockenspiel chime.',
    kind: 'sfx',
    render: (r) => {
      const glock = (f: number) =>
        bell(
          0.5,
          f,
          [
            [1, 1, 0.3],
            [2.76, 0.3, 0.08],
            [5.4, 0.12, 0.04],
          ],
          r,
          0.1,
        );
      return sequence(0.62, [
        [glock(N('C6')), 0],
        [glock(N('E6')), 0.05, 0.9],
        [glock(N('G6')), 0.1, 0.9],
        [glock(N('C7')), 0.15, 0.7],
      ]);
    },
  },
  {
    id: 'win',
    name: 'Win',
    description: 'Triumphant brass fanfare with a held major chord and cymbal swell.',
    kind: 'sfx',
    render: (r) => {
      const blip = (f: number, sec: number) =>
        brass(
          sec,
          f,
          r,
          env([
            [0, 0],
            [0.01, 1],
            [sec - 0.02, 0.85],
            [sec, 0],
          ]),
          4200,
        );
      const chordFreqs = [N('C5'), N('E5'), N('G5'), N('C6')];
      const chord = mix(
        ...chordFreqs.map((f) =>
          brass(
            1.0,
            (t) => f * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t)),
            r,
            env([
              [0, 0],
              [0.02, 1],
              [0.6, 0.85],
              [1.0, 0],
            ]),
            3800,
          ),
        ),
      );
      const swell = shape(
        highpass(noise(1.0, r), 5000),
        env([
          [0, 0.4],
          [0.1, 0.15],
          [1.0, 0],
        ]),
      );
      return reverb(
        sequence(1.6, [
          [blip(N('G4'), 0.12), 0],
          [blip(N('C5'), 0.12), 0.13],
          [blip(N('E5'), 0.12), 0.26],
          [blip(N('G5'), 0.2), 0.39],
          [blip(N('E5'), 0.1), 0.6],
          [gain(chord, 0.45), 0.7],
          [swell, 0.7, 0.5],
        ]),
        0.5,
        0.18,
        0.2,
      );
    },
  },
];

export const ALL_RECIPES: Recipe[] = [...BUZZERS, ...TICKS, ...SFX];
