// Timestamp: 2026-05-26 15:48
"use client";

import { useEffect, useRef } from "react";

type ParticleBackgroundProps = {
  className?: string;
  densityDivisor?: number; // Divisor for particle density, default 8500
  mouseInteractionRadius?: number; // Default 280
  connectionMaxDistance?: number; // Default 135
};

export function ParticleBackground({
  className = "absolute inset-0 pointer-events-none z-0 transition-opacity duration-300 opacity-80",
  densityDivisor = 8500,
  mouseInteractionRadius = 280,
  connectionMaxDistance = 135
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particlesArray: Particle[] = [];
    const mouse = {
      x: null as number | null,
      y: null as number | null,
      radius: mouseInteractionRadius
    };

    // Particle class definition
    class Particle {
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      size: number;
      color: string;

      constructor(x: number, y: number, directionX: number, directionY: number, size: number) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = "";
      }

      draw(isDark: boolean) {
        // Adjust particle opacity based on theme
        this.color = isDark ? "rgba(16, 185, 129, 0.45)" : "rgba(16, 185, 129, 0.25)";
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx!.fillStyle = this.color;
        ctx!.fill();
      }

      update(isDark: boolean) {
        this.x += this.directionX;
        this.y += this.directionY;

        // Bounce off edges
        if (this.x > canvas!.width || this.x < 0) {
          this.directionX = -this.directionX;
        }
        if (this.y > canvas!.height || this.y < 0) {
          this.directionY = -this.directionY;
        }

        // Mouse attraction physics
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            this.x += (dx / distance) * force * 1.2;
            this.y += (dy / distance) * force * 1.2;
          }
        }

        this.draw(isDark);
      }
    }

    // Populate particles based on computed parent dimensions
    function initParticles() {
      particlesArray = [];
      const numberOfParticles = Math.floor((canvas!.width * canvas!.height) / densityDivisor);

      for (let i = 0; i < numberOfParticles; i++) {
        const size = Math.random() * 2 + 1.5;
        const x = Math.random() * (canvas!.width - size * 2) + size;
        const y = Math.random() * (canvas!.height - size * 2) + size;
        const directionX = (Math.random() - 0.5) * 0.4;
        const directionY = (Math.random() - 0.5) * 0.4;

        particlesArray.push(new Particle(x, y, directionX, directionY, size));
      }
    }

    // Connect close nodes with lines
    function connect(isDark: boolean) {
      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) {
          const dx = particlesArray[a].x - particlesArray[b].x;
          const dy = particlesArray[a].y - particlesArray[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionMaxDistance) {
            const alpha = (1 - distance / connectionMaxDistance) * 0.15;
            ctx!.strokeStyle = isDark
              ? `rgba(167, 243, 208, ${alpha * 0.9})`
              : `rgba(16, 185, 129, ${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.beginPath();
            ctx!.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx!.lineTo(particlesArray[b].x, particlesArray[b].y);
            ctx!.stroke();
          }
        }

        // Draw line connections to the mouse pointer
        if (mouse.x !== null && mouse.y !== null) {
          const dx = particlesArray[a].x - mouse.x;
          const dy = particlesArray[a].y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const alpha = (1 - distance / mouse.radius) * 0.25;
            ctx!.strokeStyle = isDark
              ? `rgba(16, 185, 129, ${alpha})`
              : `rgba(5, 150, 105, ${alpha})`;
            ctx!.lineWidth = 1.0;
            ctx!.beginPath();
            ctx!.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.stroke();
          }
        }
      }
    }

    // Resize dimensions to fit parent
    function resizeCanvas() {
      const rect = parent!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
      initParticles();
    }

    // Mouse movement tracking inside parent element bounding box
    const handleMouseMove = (event: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    // Attach listeners
    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", resizeCanvas);

    // Initial sizing
    resizeCanvas();

    // Loop function
    const animate = () => {
      const isDark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update(isDark);
      }
      connect(isDark);

      animationFrameId = requestAnimationFrame(animate);
    };

    // Start loop
    animate();

    // Cleanup logic
    return () => {
      cancelAnimationFrame(animationFrameId);
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [densityDivisor, mouseInteractionRadius, connectionMaxDistance]);

  return <canvas ref={canvasRef} className={className} />;
}
