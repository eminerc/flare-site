import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./App.css";

export function HomePage() {
  const backgroundRef = useRef(null);
  const nextId = useRef(0);
  const activeCards = useRef([]);

  const imagePairs = [
    { before: "/images/img1_before.jpg", after: "/images/img1_after.png" },
    { before: "/images/img2_before.jpg", after: "/images/img2_after.png" },
    { before: "/images/img3_before.jpg", after: "/images/img3_after.png" },
    { before: "/images/img4_before.jpg", after: "/images/img4_after.png" },
    { before: "/images/img5_before.jpg", after: "/images/img5_after.png" },
    { before: "/images/img6_before.jpg", after: "/images/img6_after.png" },
    { before: "/images/img7_before.jpg", after: "/images/img7_after.png" },
    { before: "/images/img8_before.jpg", after: "/images/img8_after.png" },
    { before: "/images/img9_before.jpg", after: "/images/img9_after.png" },
    { before: "/images/img10_before.jpg", after: "/images/img10_after.png" },
    { before: "/images/img11_before.jpg", after: "/images/img11_after.png" },
    { before: "/images/img12_before.jpg", after: "/images/img12_after.png" },

    // Add more as needed
  ];

  const doesOverlap = (leftPercent, sizePx) => {
    const leftPx = (window.innerWidth * leftPercent) / 100;
    const buffer = 20;
    return activeCards.current.some((card) => {
      const cardLeftPx = (window.innerWidth * card.leftPercent) / 100;
      const cardSize = card.sizePx;
      return Math.abs(cardLeftPx - leftPx) < (cardSize + sizePx) / 2 + buffer;
    });
  };

  const createCardElement = (pair, leftPercent, sizePx, duration, id) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'bg-card';
    cardDiv.style.cssText = `
      position: absolute;
      top: -300px;
      left: ${leftPercent}%;
      width: ${sizePx}px;
      height: ${sizePx}px;
      filter: brightness(0.75) blur(1px);
      overflow: hidden;
      border-radius: 12px;
      animation: rainDown ${duration}s linear forwards;
      pointer-events: auto;
    `;

    cardDiv.innerHTML = `
      <div class="flip-card-inner">
        <div class="flip-card-front">
          <img src="${pair.after}" alt="Before" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div class="flip-card-back">
          <img src="${pair.before}" alt="After" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      </div>
    `;

    return cardDiv;
  };

  const spawnCard = () => {
    if (!backgroundRef.current) return;

    const pair = imagePairs[Math.floor(Math.random() * imagePairs.length)];
    const sizePx = 180 + Math.random() * 100;
    let leftPercent;
    let attempts = 0;

    do {
      leftPercent = Math.random() * 90;
      attempts++;
      if (attempts > 20) return;
    } while (doesOverlap(leftPercent, sizePx));

    const duration = 20 + Math.random() * 10;
    const id = nextId.current++;

    // Create and append the card element directly to the DOM
    const cardElement = createCardElement(pair, leftPercent, sizePx, duration, id);
    backgroundRef.current.appendChild(cardElement);

    // Store card info for overlap detection
    const cardInfo = { leftPercent, sizePx, id, element: cardElement };
    activeCards.current.push(cardInfo);

    // Remove the card after animation completes
    setTimeout(() => {
      if (cardElement && cardElement.parentNode) {
        cardElement.parentNode.removeChild(cardElement);
      }
      activeCards.current = activeCards.current.filter((c) => c.id !== id);
    }, duration * 1000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      spawnCard();
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="homepage" id="home">
      <div className="background" ref={backgroundRef}>
        {/* Cards will be added directly to DOM via ref */}
      </div>

      <div className="overlay-content">
        <h1 className="flare-title">Flare</h1>
        <div className="button-row">
          <Link to="/feedback" className="main-button">Feedback</Link>
          <Link to="/gallery" className="main-button">About</Link>
          <a href="/trials" className="main-button">Beta</a>
        </div>
      </div>
    </div>
  );
}