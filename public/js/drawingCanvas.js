import { evaluateStroke, normalizePoint } from './strokeChecker.js';
import { getPath2D, sampleSegment } from './pathMeasure.js';

// Reference sizes the original design was tuned at (canvas was a fixed
// 560x560 raster stretched by CSS). We keep line widths as a fraction of
// the *current* canvas size so strokes look the same proportionally no
// matter the real on-screen size or device pixel ratio.
const REF = 560;
const INK_WIDTH = 24 / REF;
const ACTIVE_WIDTH = 24 / REF;
const DEMO_DONE_WIDTH = 24 / REF;
const DEMO_ACTIVE_WIDTH = 26 / REF;
const DEMO_TIP_RADIUS = 14 / REF;

const SUCCESS_MESSAGES = ['✨ できた！', '🔥 かんぺき！', '🌟 すごい！'];
const FEEDBACK_VISIBLE_MS = 850;
const FEEDBACK_FADE_MS = 250;
const DEMO_STROKE_DURATION_MS = 700;
const DEMO_STROKE_GAP_MS = 120;
// Give the child a few quiet seconds to try the stroke from memory before
// the number/position hint appears.
const HINT_DELAY_MS = 3000;

export class DrawingCanvas {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.kanji = null;
    this.isWatermarkOn = false;
    this.isDemoPlaying = false;
    this.isTestMode = false;
    this.isPenMode = false;
    this.isTestFailed = false;
    this.lastWrongStroke = null;
    this.testReviewSnapshots = new Map();

    this.currentStrokeIndex = 0;
    this.completedStrokes = [];
    this.activeStroke = [];
    this.isDrawing = false;
    this.activePointerId = null;

    this.demoStrokeIndex = -1;
    this.demoProgress = 0;
    this.demoFrameId = null;
    this.demoGapUntil = 0;

    this.feedbackHideTimer = null;
    this.feedbackFadeTimer = null;

    this.hintDelayTimer = null;
    this.hintReadyForIndex = -1;

    this._buildDom();
    this._bindEvents();
    this._resize();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.container);

    // Safari/iPadOS can report a transiently-stale bounding rect right when
    // 'orientationchange' fires, before the post-rotation layout settles;
    // ResizeObserver alone sometimes misses that follow-up reflow. Re-measure
    // a couple of frames later as a defensive fallback.
    this._onOrientationChange = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => this._resize()));
    };
    window.addEventListener('orientationchange', this._onOrientationChange);
  }

  _buildDom() {
    this.container.classList.add('drawing-canvas-wrap');
    this.container.innerHTML = `
      <div class="dc-grid-guide">
        <div class="dc-grid-guide__box">
          <div class="dc-grid-guide__h"></div>
          <div class="dc-grid-guide__v"></div>
        </div>
      </div>
      <div class="dc-watermark"></div>
      <div class="dc-stroke-hint hidden">
        <div class="dc-stroke-hint__circle">
          <span class="dc-stroke-hint__number"></span>
        </div>
      </div>
      <div class="dc-feedback hidden">
        <div class="dc-feedback__emoji"></div>
        <div class="dc-feedback__text"></div>
      </div>
      <canvas class="dc-canvas"></canvas>
      <div class="dc-banner">
        <div class="dc-banner__inner">
          <span>🖌️</span>
          <span class="dc-banner__text"></span>
        </div>
      </div>
    `;

    this.watermarkEl = this.container.querySelector('.dc-watermark');
    this.hintEl = this.container.querySelector('.dc-stroke-hint');
    this.hintNumberEl = this.container.querySelector('.dc-stroke-hint__number');
    this.feedbackEl = this.container.querySelector('.dc-feedback');
    this.feedbackEmojiEl = this.container.querySelector('.dc-feedback__emoji');
    this.feedbackTextEl = this.container.querySelector('.dc-feedback__text');
    this.canvasEl = this.container.querySelector('.dc-canvas');
    this.bannerTextEl = this.container.querySelector('.dc-banner__text');
    this.ctx = this.canvasEl.getContext('2d');
  }

  _bindEvents() {
    this.canvasEl.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.canvasEl.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.canvasEl.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.canvasEl.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    // Backup guard: touch-action:none already blocks scrolling started on the
    // canvas, but we defensively swallow touchmove while a stroke is active
    // so iOS Safari never hands the gesture to the page underneath.
    this.canvasEl.addEventListener(
      'touchmove',
      (e) => {
        if (this.isDrawing) e.preventDefault();
      },
      { passive: false }
    );
  }

  _resize() {
    const rect = this.canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.canvasEl.width = Math.round(rect.width * dpr);
    this.canvasEl.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._render();
  }

  setKanji(kanji) {
    this.kanji = kanji;
    this.watermarkEl.textContent = kanji.character;
    this._resetProgress();
  }

  setWatermark(isOn) {
    this.isWatermarkOn = isOn;
    this.watermarkEl.classList.toggle('is-on', isOn);
  }

  // Pen mode: only a real stylus (pointerType 'pen') can draw -- a resting
  // palm or finger on the canvas is ignored instead of leaving stray marks
  // or hijacking an in-progress stroke.
  setPenMode(isOn) {
    this.isPenMode = isOn;
  }

  // Test mode: no watermark tracing, no early stroke-number hint -- the
  // child has to recall the kanji unaided, like a real test.
  setTestMode(isOn) {
    if (isOn === this.isTestMode) return;
    this.isTestMode = isOn;
    if (isOn) {
      this._clearHintTimer();
      this.hintReadyForIndex = -1;
      // A fresh test run starts with a clean review record.
      this.testReviewSnapshots = new Map();
    } else {
      this._scheduleHintForCurrentStroke();
    }
    this._updateOverlay();
  }

  clear() {
    this._resetProgress();
  }

  // Test mode "wrong" lockout: called every render with whether the current
  // kanji has hit its mistake limit this test session. Deliberately NOT
  // reset by _resetProgress()/setKanji() -- the caller (main.js) tracks the
  // mistake count per kanji id independently of the canvas's own per-attempt
  // state, so clicking "けす" (clear) to wipe the ink can't be used to
  // reset the count and keep guessing forever.
  setFailed(isFailed) {
    if (isFailed === this.isTestFailed) return;
    this.isTestFailed = isFailed;
    if (isFailed) {
      this._showFeedback('❌ ざんねん、これで おわり', 'fail');
    }
    this._updateOverlay();
  }

  setDemoPlaying(isPlaying) {
    if (isPlaying === this.isDemoPlaying) return;
    this.isDemoPlaying = isPlaying;
    if (isPlaying) {
      this._hideFeedbackImmediately();
      this._clearHintTimer();
      this._startDemo();
    } else {
      this._stopDemo();
      this._scheduleHintForCurrentStroke();
      this._render();
    }
  }

  destroy() {
    this._stopDemo();
    this._clearFeedbackTimers();
    this._clearHintTimer();
    this._resizeObserver.disconnect();
    window.removeEventListener('orientationchange', this._onOrientationChange);
  }

  _resetProgress() {
    this.currentStrokeIndex = 0;
    this.completedStrokes = [];
    this.activeStroke = [];
    this.lastWrongStroke = null;
    this.isDrawing = false;
    this.isDemoPlaying = false;
    this._stopDemo();
    this._hideFeedbackImmediately();
    this.hintReadyForIndex = -1;
    this._scheduleHintForCurrentStroke();
    document.body.classList.remove('is-drawing');
    this._render();
  }

  // ------------------------------------------------------------------
  // Stroke-number hint delay: wait a few quiet seconds before revealing
  // where/what the current stroke is, so a child gets a chance to try it
  // from memory first.
  // ------------------------------------------------------------------

  _clearHintTimer() {
    if (this.hintDelayTimer) {
      clearTimeout(this.hintDelayTimer);
      this.hintDelayTimer = null;
    }
  }

  _scheduleHintForCurrentStroke() {
    this._clearHintTimer();
    if (this.isTestMode) return;
    const targetIndex = this.currentStrokeIndex;
    this.hintDelayTimer = setTimeout(() => {
      this.hintDelayTimer = null;
      this.hintReadyForIndex = targetIndex;
      this._updateOverlay();
    }, HINT_DELAY_MS);
  }

  // ------------------------------------------------------------------
  // Pointer / drawing handling
  // ------------------------------------------------------------------

  _onPointerDown(e) {
    if (this.isDemoPlaying || !this.kanji || this.currentStrokeIndex >= this.kanji.strokes.length) {
      return;
    }
    // A second contact (e.g. a resting palm) must never interrupt a stroke
    // already in progress, and in pen mode only a real stylus may draw at
    // all -- any other pointer (finger, palm) is ignored outright.
    if (this.isDrawing) return;
    if (this.isTestFailed) return;
    if (this.isPenMode && e.pointerType !== 'pen') return;
    try {
      this.canvasEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore -- some platforms reject capture for a pointerId they don't
      // consider "active" yet; drawing still works fine without capture.
    }
    this.activePointerId = e.pointerId;
    const rect = this.canvasEl.getBoundingClientRect();
    const pt = normalizePoint({ x: e.clientX - rect.left, y: e.clientY - rect.top }, rect.width, rect.height);

    this.isDrawing = true;
    this.activeStroke = [pt];
    document.body.classList.add('is-drawing');
  }

  _onPointerMove(e) {
    if (!this.isDrawing || e.pointerId !== this.activePointerId) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const pt = normalizePoint({ x: e.clientX - rect.left, y: e.clientY - rect.top }, rect.width, rect.height);
    this.activeStroke.push(pt);
    this._render();
  }

  _onPointerUp(e) {
    if (!this.isDrawing || e.pointerId !== this.activePointerId) return;
    this.isDrawing = false;
    this.activePointerId = null;
    document.body.classList.remove('is-drawing');
    try {
      this.canvasEl.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (this.activeStroke.length < 2) {
      this.activeStroke = [];
      this._render();
      return;
    }

    const expectedStroke = this.kanji.strokes[this.currentStrokeIndex];
    const result = evaluateStroke(this.activeStroke, expectedStroke, this.isWatermarkOn ? 28 : 22);

    if (result.isCorrect) {
      const nextIndex = this.currentStrokeIndex + 1;
      this.completedStrokes.push(this.activeStroke);
      this.currentStrokeIndex = nextIndex;
      this.activeStroke = [];

      const isComplete = nextIndex >= this.kanji.strokes.length;
      if (isComplete) {
        // Don't show the small per-stroke popup here: it would visually
        // collide with the full-screen completion celebration that's
        // about to fire, so only one effect is ever on screen at once.
        this._hideFeedbackImmediately();
        this._clearHintTimer();
      } else {
        const msg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
        this._showFeedback(msg, 'success');
        this._scheduleHintForCurrentStroke();
      }

      this._render();
      this._updateOverlay();
      this.callbacks.onStrokeSuccess(nextIndex, this.kanji.strokes.length);
      if (isComplete) {
        if (this.isTestMode) this._saveTestReviewSnapshot('correct');
        this.callbacks.onKanjiComplete(this.isWatermarkOn);
      }
    } else {
      const attemptedPoints = this.activeStroke;
      this.activeStroke = [];
      this._showFeedback(result.message || 'もういちど書いてみよう！', 'assist');
      // onStrokeFail runs main.js's mistake-count logic synchronously, which
      // may call our own setFailed(true) right inside this call if this
      // attempt crosses the test-mode mistake limit -- checking isTestFailed
      // right after tells us whether THIS was the fatal stroke.
      const wasFailedBefore = this.isTestFailed;
      this.callbacks.onStrokeFail(this.currentStrokeIndex, result.message || 'おしい！もういちど書いてみよう！');
      const justFailed = !wasFailedBefore && this.isTestFailed;
      if (justFailed) {
        // Keep the fatal wrong stroke visible (in red) instead of wiping it
        // like a normal retry, so both the on-screen lock state and the
        // review snapshot show exactly what the mistake looked like.
        this.lastWrongStroke = attemptedPoints;
      }
      this._render();
      if (justFailed) {
        this._saveTestReviewSnapshot('fail');
        // callbacks.onStrokeFail() above already triggered main.js's
        // re-render, but that happened *before* this snapshot existed
        // (we only know a stroke was fatal by observing what that call
        // did to our own isTestFailed flag). Prompt one more render so
        // the "テストのけっかをみる" button/modal reflect it immediately
        // instead of lagging one interaction behind.
        this.callbacks.onTestResultRecorded();
      }
    }
  }

  // ------------------------------------------------------------------
  // Test-mode review snapshots: a record of what was actually drawn for
  // each kanji attempted this test session (correct completions and
  // fatal-mistake lockouts alike), so a parent/teacher can look back over
  // the child's real handwriting afterward instead of just the pass/fail
  // verdict.
  // ------------------------------------------------------------------

  _saveTestReviewSnapshot(outcome) {
    if (!this.kanji) return;
    this.testReviewSnapshots.set(this.kanji.id, {
      kanjiId: this.kanji.id,
      character: this.kanji.character,
      outcome,
      imageDataUrl: this.canvasEl.toDataURL('image/png'),
      timestamp: Date.now(),
    });
  }

  getTestReviewSnapshots() {
    return Array.from(this.testReviewSnapshots.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  // ------------------------------------------------------------------
  // Feedback popup (single reusable node, timer-managed so it never stacks)
  // ------------------------------------------------------------------

  _clearFeedbackTimers() {
    if (this.feedbackHideTimer) {
      clearTimeout(this.feedbackHideTimer);
      this.feedbackHideTimer = null;
    }
    if (this.feedbackFadeTimer) {
      clearTimeout(this.feedbackFadeTimer);
      this.feedbackFadeTimer = null;
    }
  }

  _showFeedback(text, type) {
    this._clearFeedbackTimers();

    this.feedbackEmojiEl.textContent = type === 'success' ? '✨' : type === 'fail' ? '❌' : '🔥';
    this.feedbackTextEl.textContent = text;
    this.feedbackTextEl.className = `dc-feedback__text ${type}`;

    this.feedbackEl.classList.remove('hidden', 'is-leaving');
    // Restart the entrance animation even if it's already showing.
    this.feedbackEl.style.animation = 'none';
    void this.feedbackEl.offsetWidth;
    this.feedbackEl.style.animation = '';

    this.feedbackFadeTimer = setTimeout(() => {
      this.feedbackEl.classList.add('is-leaving');
      this.feedbackHideTimer = setTimeout(() => {
        this.feedbackEl.classList.add('hidden');
        this.feedbackEl.classList.remove('is-leaving');
      }, FEEDBACK_FADE_MS);
    }, FEEDBACK_VISIBLE_MS);
  }

  _hideFeedbackImmediately() {
    this._clearFeedbackTimers();
    this.feedbackEl.classList.add('hidden');
    this.feedbackEl.classList.remove('is-leaving');
  }

  // ------------------------------------------------------------------
  // Demo ("見本") playback — follows the real svgPath geometry so curved
  // and hooked strokes animate correctly instead of a straight line
  // between the stroke's start/end points.
  // ------------------------------------------------------------------

  _startDemo() {
    this._stopDemo();
    if (!this.kanji || this.kanji.strokes.length === 0) {
      this.callbacks.onDemoEnd();
      return;
    }
    this.demoStrokeIndex = 0;
    this.demoProgress = 0;
    this.demoGapUntil = 0;
    let last = performance.now();

    const tick = (now) => {
      const dt = now - last;
      last = now;

      if (now >= this.demoGapUntil) {
        this.demoProgress += dt / DEMO_STROKE_DURATION_MS;
        if (this.demoProgress >= 1) {
          this.demoProgress = 1;
          this._render();
          this.demoStrokeIndex += 1;
          if (this.demoStrokeIndex >= this.kanji.strokes.length) {
            this.demoFrameId = null;
            this.demoStrokeIndex = -1;
            this.demoProgress = 0;
            this.isDemoPlaying = false;
            this._scheduleHintForCurrentStroke();
            this._render();
            this.callbacks.onDemoEnd();
            return;
          }
          this.demoProgress = 0;
          this.demoGapUntil = now + DEMO_STROKE_GAP_MS;
        }
      }

      this._render();
      this.demoFrameId = requestAnimationFrame(tick);
    };

    this.demoFrameId = requestAnimationFrame(tick);
  }

  _stopDemo() {
    if (this.demoFrameId) {
      cancelAnimationFrame(this.demoFrameId);
      this.demoFrameId = null;
    }
    this.demoStrokeIndex = -1;
    this.demoProgress = 0;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  _updateOverlay() {
    if (!this.kanji) return;
    const total = this.kanji.strokes.length;
    const isComplete = this.currentStrokeIndex >= total;
    const currentStroke = this.kanji.strokes[this.currentStrokeIndex];

    const showHint =
      !this.isDemoPlaying &&
      !this.isTestMode &&
      !isComplete &&
      currentStroke &&
      this.hintReadyForIndex === this.currentStrokeIndex;
    this.hintEl.classList.toggle('hidden', !showHint);
    if (showHint) {
      this.hintEl.style.left = `${currentStroke.start.x}%`;
      this.hintEl.style.top = `${currentStroke.start.y}%`;
      this.hintNumberEl.textContent = String(currentStroke.strokeNumber);
    }

    if (isComplete) {
      this.bannerTextEl.textContent = '🎉 完成！！';
    } else if (this.isTestFailed) {
      this.bannerTextEl.textContent = '❌ ざんねん、つぎの かん字に すすもう';
    } else if (this.isTestMode) {
      // Test mode must not reveal the stroke number/total or the hint
      // sentence -- both count as answer-adjacent help.
      this.bannerTextEl.textContent = 'じぶんの ちからで かいてみよう！';
    } else {
      const hint = currentStroke?.hintText || 'ていねいに書こう！';
      this.bannerTextEl.textContent = `書き順 ${this.currentStrokeIndex + 1} / ${total}画: ${hint}`;
    }
  }

  _render() {
    if (!this.ctx || !this.kanji) return;
    const w = this.cssWidth || this.canvasEl.clientWidth;
    const h = this.cssHeight || this.canvasEl.clientHeight;
    this.ctx.clearRect(0, 0, w, h);

    const drawPointsPath = (pts, strokeStyle, lineWidthFrac) => {
      if (!pts || pts.length < 2) return;
      this.ctx.beginPath();
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = lineWidthFrac * w;
      this.ctx.moveTo((pts[0].x / 100) * w, (pts[0].y / 100) * h);
      for (let i = 1; i < pts.length; i++) {
        this.ctx.lineTo((pts[i].x / 100) * w, (pts[i].y / 100) * h);
      }
      this.ctx.stroke();
    };

    // 1. Completed user strokes (their own free-hand ink)
    for (const stroke of this.completedStrokes) {
      drawPointsPath(stroke, '#1E293B', INK_WIDTH);
    }

    // 1b. The fatal wrong stroke that triggered a test-mode lockout, kept
    // visible in red instead of being wiped like a normal retry would be.
    if (this.isTestFailed && this.lastWrongStroke) {
      drawPointsPath(this.lastWrongStroke, '#E71D36', INK_WIDTH);
    }

    // 2. Currently active user stroke
    if (this.activeStroke.length > 0) {
      drawPointsPath(this.activeStroke, '#FF9F1C', ACTIVE_WIDTH);
    }

    // 3. Demo ("見本") playback, following the real svgPath geometry
    if (this.isDemoPlaying && this.demoStrokeIndex >= 0) {
      // svgPath coordinates are authored in a 0-100 square. Scale x and y
      // independently (not by a single shared factor) so paths still line
      // up with the hint/watermark overlay -- which are positioned as
      // percentages of the actual (possibly non-square) canvas box -- even
      // when the box isn't perfectly square.
      const scaleX = w / 100;
      const scaleY = h / 100;

      // Already-shown demo strokes: render the exact authored path shape.
      for (let i = 0; i < this.demoStrokeIndex; i++) {
        const strokeData = this.kanji.strokes[i];
        if (!strokeData?.svgPath) continue;
        this.ctx.save();
        this.ctx.scale(scaleX, scaleY);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#2EC4B6';
        this.ctx.lineWidth = DEMO_DONE_WIDTH * 100;
        this.ctx.stroke(getPath2D(strokeData.svgPath));
        this.ctx.restore();
      }

      // Currently animating stroke: sample real points along the path up
      // to the current progress so curves/hooks/sweeps are followed
      // exactly instead of cutting a straight line across the character.
      const currentDemo = this.kanji.strokes[this.demoStrokeIndex];
      if (currentDemo?.svgPath) {
        const points = sampleSegment(currentDemo.svgPath, 0, this.demoProgress, 24);
        if (points.length >= 2) {
          drawPointsPath(points, '#E71D36', DEMO_ACTIVE_WIDTH);
        }
        const tip = points[points.length - 1];
        if (tip) {
          this.ctx.beginPath();
          this.ctx.arc((tip.x / 100) * w, (tip.y / 100) * h, DEMO_TIP_RADIUS * w, 0, Math.PI * 2);
          this.ctx.fillStyle = '#FF9F1C';
          this.ctx.fill();
        }
      }
    }

    this._updateOverlay();
  }
}
