import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KanjiItem, Point } from '../types';
import { evaluateStroke, normalizePoint } from '../utils/strokeChecker';

interface DrawingCanvasProps {
  kanji: KanjiItem;
  isWatermarkOn: boolean;
  onStrokeSuccess: (strokeIndex: number, totalStrokes: number) => void;
  onStrokeFail: (strokeIndex: number, message: string) => void;
  onKanjiComplete: (isWatermarkOn: boolean) => void;
  isDemoPlaying: boolean;
  onDemoEnd: () => void;
  clearTrigger: number; // Increment to clear canvas
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  kanji,
  isWatermarkOn,
  onStrokeSuccess,
  onStrokeFail,
  onKanjiComplete,
  isDemoPlaying,
  onDemoEnd,
  clearTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [currentStrokeIndex, setCurrentStrokeIndex] = useState<number>(0);
  const [completedStrokes, setCompletedStrokes] = useState<Point[][]>([]);
  const [activeStroke, setActiveStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [feedbackPopup, setFeedbackPopup] = useState<{
    text: string;
    type: 'success' | 'perfect' | 'assist';
    id: number;
  } | null>(null);

  const [demoStrokeIndex, setDemoStrokeIndex] = useState<number>(-1);
  const [demoProgress, setDemoProgress] = useState<number>(0);

  // Reset progress when kanji changes or clearTrigger changes
  useEffect(() => {
    setCurrentStrokeIndex(0);
    setCompletedStrokes([]);
    setActiveStroke([]);
    setFeedbackPopup(null);
    setDemoStrokeIndex(-1);
    setDemoProgress(0);
  }, [kanji.id, clearTrigger]);

  // Demo animation loop
  useEffect(() => {
    if (!isDemoPlaying) {
      setDemoStrokeIndex(-1);
      setDemoProgress(0);
      return;
    }

    let frameId: number;
    let sIndex = 0;
    let progress = 0;

    const animateDemo = () => {
      progress += 0.04;
      if (progress >= 1) {
        progress = 0;
        sIndex++;
        if (sIndex >= kanji.strokes.length) {
          onDemoEnd();
          return;
        }
      }
      setDemoStrokeIndex(sIndex);
      setDemoProgress(progress);
      frameId = requestAnimationFrame(animateDemo);
    };

    setDemoStrokeIndex(0);
    setDemoProgress(0);
    frameId = requestAnimationFrame(animateDemo);

    return () => cancelAnimationFrame(frameId);
  }, [isDemoPlaying, kanji.strokes.length, onDemoEnd]);

  // Handle pointer down (stylus, finger, or mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDemoPlaying || currentStrokeIndex >= kanji.strokes.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const pt = normalizePoint(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      rect.width,
      rect.height
    );

    setIsDrawing(true);
    setActiveStroke([pt]);
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isDemoPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pt = normalizePoint(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      rect.width,
      rect.height
    );

    setActiveStroke((prev) => [...prev, pt]);
  };

  // Handle pointer up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }

      if (activeStroke.length < 2) {
        setActiveStroke([]);
        return;
      }

      const expectedStroke = kanji.strokes[currentStrokeIndex];
      const result = evaluateStroke(activeStroke, expectedStroke, isWatermarkOn ? 28 : 22);

      if (result.isCorrect) {
        const nextIndex = currentStrokeIndex + 1;
        setCompletedStrokes((prev) => [...prev, activeStroke]);
        setCurrentStrokeIndex(nextIndex);
        setActiveStroke([]);

        // Show feedback popup
        const messages = ['✨ GOOD!', '🔥 PERFECT!', '🌟 NICE!'];
        const randomMsg = messages[Math.floor(Math.random() * messages.length)];
        setFeedbackPopup({
          text: randomMsg,
          type: 'success',
          id: Date.now(),
        });

        onStrokeSuccess(nextIndex, kanji.strokes.length);

        if (nextIndex >= kanji.strokes.length) {
          onKanjiComplete(isWatermarkOn);
        }
      } else {
        setActiveStroke([]);
        setFeedbackPopup({
          text: result.message || 'もういちど書いてみよう！',
          type: 'assist',
          id: Date.now(),
        });
        onStrokeFail(currentStrokeIndex, result.message || 'おしい！もういちど書いてみよう！');
      }
    },
    [activeStroke, currentStrokeIndex, isDrawing, isWatermarkOn, kanji.strokes, onKanjiComplete, onStrokeFail, onStrokeSuccess]
  );

  // Render canvas graphics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Helper to draw a path of normalized points
    const drawPointsPath = (pts: Point[], strokeStyle: string, lineWidth: number) => {
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;

      ctx.moveTo((pts[0].x / 100) * w, (pts[0].y / 100) * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i].x / 100) * w, (pts[i].y / 100) * h);
      }
      ctx.stroke();
    };

    // 1. Draw completed user strokes
    for (const stroke of completedStrokes) {
      drawPointsPath(stroke, '#1E293B', 24); // Bold ink color #1E293B
    }

    // 2. Draw currently active stroke
    if (activeStroke.length > 0) {
      drawPointsPath(activeStroke, '#FF9F1C', 24); // Orange while drawing
    }

    // 3. Draw demo playback if active
    if (isDemoPlaying && demoStrokeIndex >= 0) {
      // Draw already shown demo strokes
      for (let i = 0; i < demoStrokeIndex; i++) {
        const strokeData = kanji.strokes[i];
        if (strokeData?.start && strokeData?.end) {
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#2EC4B6';
          ctx.lineWidth = 24;
          ctx.moveTo((strokeData.start.x / 100) * w, (strokeData.start.y / 100) * h);
          ctx.lineTo((strokeData.end.x / 100) * w, (strokeData.end.y / 100) * h);
          ctx.stroke();
        }
      }

      // Draw current animated demo stroke
      const currentDemo = kanji.strokes[demoStrokeIndex];
      if (currentDemo) {
        const sx = (currentDemo.start.x / 100) * w;
        const sy = (currentDemo.start.y / 100) * h;
        const ex = (currentDemo.end.x / 100) * w;
        const ey = (currentDemo.end.y / 100) * h;

        const curX = sx + (ex - sx) * demoProgress;
        const curY = sy + (ey - sy) * demoProgress;

        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#E71D36';
        ctx.lineWidth = 26;
        ctx.moveTo(sx, sy);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Glowing brush tip
        ctx.beginPath();
        ctx.arc(curX, curY, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#FF9F1C';
        ctx.fill();
      }
    }
  }, [activeStroke, completedStrokes, demoProgress, demoStrokeIndex, isDemoPlaying, kanji.strokes]);

  const currentStrokeHint = kanji.strokes[currentStrokeIndex];

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full max-w-[560px] aspect-square bg-white rounded-[40px] shadow-2xl relative flex flex-col items-center justify-center border-4 border-[#FF9F1C] overflow-hidden select-none"
    >
      {/* Writing Grid Lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[86%] h-[86%] border-2 border-[#FF9F1C]/30 relative rounded-3xl">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#FF9F1C]/40"></div>
          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-[#FF9F1C]/40"></div>
        </div>
      </div>

      {/* Trace / Watermark Text (only visible if watermark mode is ON or Demo is playing) */}
      <div
        className={`text-[280px] sm:text-[340px] md:text-[380px] font-serif absolute select-none pointer-events-none flex items-center justify-center transition-all duration-300 ${
          isWatermarkOn ? 'text-gray-200 opacity-90' : 'text-gray-100 opacity-30'
        }`}
      >
        {kanji.character}
      </div>

      {/* Stroke Number & Direction Indicator for current stroke */}
      {!isDemoPlaying && currentStrokeIndex < kanji.strokes.length && currentStrokeHint && (
        <div
          className="absolute z-20 pointer-events-none transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${currentStrokeHint.start.x}%`,
            top: `${currentStrokeHint.start.y}%`,
          }}
        >
          <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-[#E71D36] bg-white/90 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-[#E71D36] font-black text-lg md:text-xl">
              {currentStrokeHint.strokeNumber}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Feedback Elements (Static/Dynamic Simulation) */}
      {feedbackPopup && (
        <div
          key={feedbackPopup.id}
          className="absolute top-8 right-8 z-30 pointer-events-none text-center animate-bounce"
        >
          <div className="text-4xl md:text-5xl mb-1">
            {feedbackPopup.type === 'success' ? '✨' : '🔥'}
          </div>
          <div
            className={`font-black px-4 py-2 rounded-full text-base md:text-xl rotate-6 shadow-lg whitespace-nowrap ${
              feedbackPopup.type === 'success'
                ? 'bg-[#2EC4B6] text-white'
                : 'bg-[#FF9F1C] text-white'
            }`}
          >
            {feedbackPopup.text}
          </div>
        </div>
      )}

      {/* Main Drawing Canvas (Stylus & Finger Touch Mode) */}
      <canvas
        ref={canvasRef}
        width={560}
        height={560}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full z-10 touch-none cursor-crosshair"
      ></canvas>

      {/* Stroke Order Hint Banner at the bottom of canvas */}
      <div className="absolute bottom-4 inset-x-6 z-20 pointer-events-none flex justify-center">
        <div className="bg-[#011627]/85 text-white text-xs md:text-sm font-bold px-4 py-1.5 rounded-full shadow-md flex items-center space-x-2">
          <span>🖌️</span>
          <span>
            {currentStrokeIndex < kanji.strokes.length
              ? `書き順 ${currentStrokeIndex + 1} / ${kanji.strokes.length}画: ${
                  currentStrokeHint?.hintText || 'ていねいに書こう！'
                }`
              : '🎉 完成！！'}
          </span>
        </div>
      </div>
    </div>
  );
};
