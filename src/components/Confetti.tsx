import { useEffect, useRef, useCallback } from 'react';

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  shape: 'square' | 'circle' | 'star';
}

interface ConfettiProps {
  trigger: boolean;
  duration?: number;
  particleCount?: number;
}

/**
 * Confetti celebration effect
 * Triggers when someone achieves something awesome
 */
export function Confetti({ trigger, duration = 3000, particleCount = 100 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const piecesRef = useRef<ConfettiPiece[]>([]);

  const colors = [
    '#fbbf24', '#f59e0b', '#ef4444', '#ec4899', 
    '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981',
    '#f97316', '#6366f1'
  ];

  const createPieces = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return [];

    const centerX = canvas.width / 2;
    const pieces: ConfettiPiece[] = [];
    const shapes: Array<'square' | 'circle' | 'star'> = ['square', 'circle', 'star'];

    for (let i = 0; i < particleCount; i++) {
      pieces.push({
        x: centerX + (Math.random() - 0.5) * 200,
        y: -20,
        vx: (Math.random() - 0.5) * 15,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      });
    }

    return pieces;
  }, [particleCount]);

  const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size / 2;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    piecesRef.current = createPieces();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        piecesRef.current = [];
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      piecesRef.current.forEach(piece => {
        // Update physics
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.15; // gravity
        piece.vx *= 0.99; // air resistance
        piece.rotation += piece.rotationSpeed;

        // Draw
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate((piece.rotation * Math.PI) / 180);
        ctx.fillStyle = piece.color;

        if (piece.shape === 'square') {
          ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        } else if (piece.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, piece.size / 2);
        }

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [trigger, duration, createPieces]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ background: 'transparent' }}
    />
  );
}
