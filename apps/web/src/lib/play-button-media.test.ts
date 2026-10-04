import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { BoardButton } from '@voxa/core';
import {
  estimateUtteranceMs,
  MEDIA_PAUSE_CAP_MS,
  MEDIA_PAUSE_MARGIN_MS,
  MEDIA_POLL_MS,
  MEDIA_STALL_MS,
  mediaPauseBoundMs,
  resetSpeechActivityForTests,
  resetSpeechPreferencesForTests,
  speakButton,
  subscribeSpeechActivity,
} from './play-button-speech';

// Recorded speech and GLP video hold the switch-scan pause only while they
// play: a clip that stalls is given up and its text spoken instead.
// Speech itself is covered in play-button-speech.test.ts.

const g = globalThis as unknown as Record<string, unknown>;
let spoken: Array<{ text: string }> = [];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  spoken = [];
  g.SpeechSynthesisUtterance = class {
    text: string;
    lang = '';
    voice = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  g.window = {
    speechSynthesis: {
      speak: (u: { text: string }) => spoken.push(u),
      cancel: () => undefined,
      getVoices: () => [],
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  resetSpeechPreferencesForTests();
  resetSpeechActivityForTests();
});

afterEach(() => {
  resetSpeechActivityForTests();
  delete g.window;
  delete g.SpeechSynthesisUtterance;
  globalThis.fetch = originalFetch;
});

/**
 * A media element that does only what a test tells it: its position moves
 * when the test advances it, and it fires an event only when the test calls
 * `fire`. Doubles as the GLP `<video>` (it has the few DOM members the dialog
 * uses).
 */
class FakeMedia {
  static created: FakeMedia[] = [];
  static nextPlay: () => Promise<void> = () => Promise.resolve();
  src = '';
  currentTime = 0;
  duration = Number.NaN;
  ended = false;
  playbackRate = 1;
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  readonly listeners = new Map<string, Set<() => void>>();
  // DOM members used by the GLP video dialog.
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent = '';
  type = '';
  playsInline = false;
  removed = false;
  constructor(src?: string) {
    if (src) this.src = src;
    FakeMedia.created.push(this);
  }
  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return FakeMedia.nextPlay();
  }
  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }
  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
  setAttribute(): void {}
  append(): void {}
  appendChild(): void {}
  focus(): void {}
  remove(): void {
    this.removed = true;
  }
}

describe('recorded media holds the scan pause only while it plays', () => {
  let active = false;
  let unsubscribe: () => void = () => undefined;
  let dialogs: FakeMedia[] = [];

  /** Lets the fetch, blob and promise chains of speakButton run (setImmediate is not mocked). */
  const flush = async () => {
    for (let i = 0; i < 10; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  };

  const recorded = {
    kind: 'analytic',
    id: 'r1',
    label: 'agua',
    speechText: 'agua',
    locale: 'es-MX',
    position: { row: 0, column: 0 },
    locked: false,
    audio: { url: '/api/media/clip', recordedBy: 'caregiver' },
  } as unknown as BoardButton;

  const glp = {
    kind: 'glp',
    id: 'g1',
    label: 'vamos',
    phrase: 'vamos al parque',
    locale: 'es-MX',
    position: { row: 0, column: 1 },
    locked: false,
    video: { url: '/api/media/video' },
  } as unknown as BoardButton;

  /** Starts a recorded clip and returns its media element, with the pause held. */
  async function startClip(
    button: BoardButton = recorded,
  ): Promise<{ media: FakeMedia; done: Promise<void> }> {
    const done = speakButton(button, { closeLabel: 'Cerrar' });
    await flush();
    const media = FakeMedia.created.find((m) => m.playCalls > 0);
    assert.ok(media, 'a media element was played');
    assert.equal(active, true, 'the scan pause is held while the media plays');
    return { media, done };
  }

  /** Advances the clock in poll steps, moving the media position by the same amount when `playing`. */
  function play(media: FakeMedia, ms: number, playing = true): void {
    for (let elapsed = 0; elapsed < ms; elapsed += MEDIA_POLL_MS) {
      if (playing) media.currentTime += MEDIA_POLL_MS / 1000;
      mock.timers.tick(MEDIA_POLL_MS);
    }
  }

  beforeEach(() => {
    FakeMedia.created = [];
    FakeMedia.nextPlay = () => Promise.resolve();
    dialogs = [];
    g.Audio = FakeMedia;
    g.HTMLElement = FakeMedia;
    g.document = {
      activeElement: null,
      body: { appendChild: (el: FakeMedia) => dialogs.push(el) },
      createElement: () => new FakeMedia(),
    };
    globalThis.fetch = (async () =>
      new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }))) as typeof fetch;
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
    unsubscribe = subscribeSpeechActivity((value) => {
      active = value;
    });
  });

  afterEach(() => {
    unsubscribe();
    resetSpeechActivityForTests();
    mock.timers.reset();
    delete g.Audio;
    delete g.HTMLElement;
    delete g.document;
  });

  it('bounds by the stated length plus a margin, and caps an unknown length', () => {
    assert.equal(mediaPauseBoundMs(2), 2000 + MEDIA_PAUSE_MARGIN_MS);
    assert.equal(
      mediaPauseBoundMs(2, 2),
      1000 + MEDIA_PAUSE_MARGIN_MS,
      'a faster rate plays shorter',
    );
    assert.equal(
      mediaPauseBoundMs(2, 0),
      2000 + MEDIA_PAUSE_MARGIN_MS,
      'an invalid rate counts as 1',
    );
    for (const unknown of [Number.POSITIVE_INFINITY, Number.NaN, 0, -1]) {
      assert.equal(mediaPauseBoundMs(unknown), MEDIA_PAUSE_CAP_MS, String(unknown));
    }
  });

  it('a clip that never fires ended and never advances releases at the stall bound and speaks the text', async () => {
    const { media, done } = await startClip();
    mock.timers.tick(MEDIA_STALL_MS - MEDIA_POLL_MS);
    assert.equal(active, true, 'held until the stall bound');
    assert.equal(spoken.length, 0);
    mock.timers.tick(MEDIA_POLL_MS);
    await flush();
    await done;
    assert.equal(media.paused, true, 'the stuck clip is stopped');
    assert.deepEqual(
      spoken.map((u) => u.text),
      ['agua'],
      'the button speech text is spoken instead',
    );
    assert.equal(
      media.listenerCount('ended') + media.listenerCount('error') + media.listenerCount('abort'),
      0,
    );
    mock.timers.tick(estimateUtteranceMs('agua'));
    assert.equal(active, false, 'the spoken fallback is bounded as well');
  });

  it('a clip that plays to its stated end without an ended event releases at the bound, without repeating it', async () => {
    const { media, done } = await startClip();
    media.duration = 2;
    play(media, 2000);
    assert.equal(media.currentTime, 2);
    // First progress was seen at the first poll; the bound counts from there.
    play(media, mediaPauseBoundMs(2) - 2000, false);
    assert.equal(active, true, 'held through the length and margin');
    play(media, MEDIA_POLL_MS, false);
    await flush();
    await done;
    assert.equal(active, false, 'released at the bound');
    assert.equal(spoken.length, 0, 'a clip that was heard is not spoken again');
  });

  it('a clip of unknown length that keeps playing is stopped at the cap, without speech', async () => {
    const { media, done } = await startClip();
    media.duration = Number.POSITIVE_INFINITY;
    play(media, MEDIA_PAUSE_CAP_MS);
    assert.equal(active, true, 'held while it plays, up to the cap');
    play(media, MEDIA_POLL_MS);
    await flush();
    await done;
    assert.equal(active, false, 'released at the cap');
    assert.equal(media.paused, true, 'stopped at the cap');
    assert.equal(spoken.length, 0);
  });

  it('a stalled clip that does not recover is released and spoken; one that recovers keeps playing', async () => {
    const { media, done } = await startClip();
    media.duration = 10;
    play(media, 1000);
    media.fire('stalled');
    play(media, 3000, false);
    media.fire('waiting');
    play(media, 1000);
    assert.equal(active, true, 'recovered within the stall window: still held');
    assert.equal(spoken.length, 0);
    play(media, MEDIA_STALL_MS - MEDIA_POLL_MS, false);
    assert.equal(active, true);
    play(media, MEDIA_POLL_MS, false);
    await flush();
    await done;
    assert.deepEqual(
      spoken.map((u) => u.text),
      ['agua'],
    );
    assert.equal(media.paused, true);
  });

  for (const event of ['error', 'abort'] as const) {
    it(`${event} releases at once and speaks the text`, async () => {
      const { media, done } = await startClip();
      media.fire(event);
      await flush();
      await done;
      assert.deepEqual(
        spoken.map((u) => u.text),
        ['agua'],
      );
      mock.timers.tick(estimateUtteranceMs('agua'));
      assert.equal(active, false);
    });
  }

  it('a refused play() speaks the text', async () => {
    FakeMedia.nextPlay = () => Promise.reject(new Error('NotAllowedError'));
    const done = speakButton(recorded, { closeLabel: 'Cerrar' });
    await flush();
    await done;
    assert.deepEqual(
      spoken.map((u) => u.text),
      ['agua'],
    );
  });

  it('a play() that never settles is a stall too', async () => {
    FakeMedia.nextPlay = () => new Promise<void>(() => undefined);
    const { done } = await startClip();
    mock.timers.tick(MEDIA_STALL_MS);
    await flush();
    await done;
    assert.deepEqual(
      spoken.map((u) => u.text),
      ['agua'],
    );
  });

  it('ended releases at once, speaks nothing and leaves no timer or listener behind', async () => {
    const { media, done } = await startClip();
    media.currentTime = 1;
    media.ended = true;
    media.fire('ended');
    await flush();
    await done;
    assert.equal(active, false);
    assert.equal(
      media.listenerCount('ended') + media.listenerCount('error') + media.listenerCount('abort'),
      0,
    );
    mock.timers.tick(MEDIA_PAUSE_CAP_MS * 2);
    assert.equal(spoken.length, 0);
    assert.equal(active, false);
  });

  it('a GLP video that stalls closes its dialog and speaks the phrase', async () => {
    const { media, done } = await startClip(glp);
    assert.equal(dialogs.length, 1, 'the video dialog is on screen');
    mock.timers.tick(MEDIA_STALL_MS);
    await flush();
    await done;
    assert.equal(dialogs[0]!.removed, true, 'the dialog closed');
    assert.equal(media.paused, true);
    assert.deepEqual(
      spoken.map((u) => u.text),
      ['vamos al parque'],
    );
    mock.timers.tick(estimateUtteranceMs('vamos al parque'));
    assert.equal(active, false);
  });

  it('a GLP video that ends closes its dialog without speech', async () => {
    const { media, done } = await startClip(glp);
    media.ended = true;
    media.fire('ended');
    await flush();
    await done;
    assert.equal(dialogs[0]!.removed, true);
    assert.equal(spoken.length, 0);
    assert.equal(active, false);
  });
});
