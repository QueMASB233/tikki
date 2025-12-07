"use client";

import { useEffect, useState, useRef } from "react";
import clsx from "clsx";

interface AnimatedTitleProps {
  text: string;
  className?: string;
  onDoubleClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export function AnimatedTitle({ text, className, onDoubleClick, title }: AnimatedTitleProps) {
  const [displayedText, setDisplayedText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    // Solo animar si el texto cambió
    if (text === prevTextRef.current) {
      return;
    }
    
    prevTextRef.current = text;
    setIsAnimating(true);
    setDisplayedText("");
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 15); // Velocidad de escritura (15ms por carácter)

    return () => clearInterval(interval);
  }, [text]);

  return (
    <p
      className={clsx(className, isAnimating && "opacity-90")}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      {displayedText}
      {isAnimating && <span className="animate-pulse ml-0.5">|</span>}
    </p>
  );
}

