import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function DemoGallery() {
  const navigate = useNavigate();
  const [isGalleryHovered, setIsGalleryHovered] = useState(false);
  const [topRowPaused, setTopRowPaused] = useState(false);
  const [bottomRowPaused, setBottomRowPaused] = useState(false);
  const [flippedImages, setFlippedImages] = useState(new Set());
  const [isMobile, setIsMobile] = useState(false);

  const topRowRef = useRef(null);
  const bottomRowRef = useRef(null);
  const topRowTimeoutRef = useRef(null);
  const bottomRowTimeoutRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice =
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        "ontouchstart" in window;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (topRowRef.current && !topRowPaused) {
      topRowRef.current.classList.add("scroll-right");
    }
    if (bottomRowRef.current && !bottomRowPaused) {
      bottomRowRef.current.classList.add("scroll-left");
    }
  }, [topRowPaused, bottomRowPaused]);

  const handleImageClick = (imageId) => {
    setFlippedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) newSet.delete(imageId);
      else newSet.add(imageId);
      return newSet;
    });
  };

  const handleScroll = (e, isTopRow) => {
    const container = e.target;
    if (isTopRow) {
      setTopRowPaused(true);
      container.classList.add("paused");
      if (topRowTimeoutRef.current) clearTimeout(topRowTimeoutRef.current);
      topRowTimeoutRef.current = setTimeout(() => {
        setTopRowPaused(false);
        container.classList.remove("paused");
      }, 3000);
    } else {
      setBottomRowPaused(true);
      container.classList.add("paused");
      if (bottomRowTimeoutRef.current) clearTimeout(bottomRowTimeoutRef.current);
      bottomRowTimeoutRef.current = setTimeout(() => {
        setBottomRowPaused(false);
        container.classList.remove("paused");
      }, 3000);
    }

    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    if (scrollLeft > scrollWidth - clientWidth - 1000) {
      const track = container.querySelector(".gallery-track");
      const images = isTopRow ? topRowImages : bottomRowImages;

      for (let i = 0; i < 10; i++) {
        const imageIndex = i % 3;
        const image = images[imageIndex];
        const imageElement = document.createElement("div");
        imageElement.className = "gallery-item";
        imageElement.setAttribute("data-image-id", `${isTopRow ? "top" : "bottom"}-${Date.now()}-${i}`);
        imageElement.innerHTML = `
          <div class="image-container">
            <img src="${image.before}" alt="Original" class="image-before" />
            <img src="${image.after}" alt="Enhanced" class="image-after" />
          </div>
          <div class="enhancement-badge">flare</div>
        `;

        const currentIsMobile =
          window.innerWidth <= 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
          "ontouchstart" in window;

        if (currentIsMobile) {
          imageElement.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyFlipped = e.currentTarget.classList.contains("flipped");
            const badge = e.currentTarget.querySelector(".enhancement-badge");
            if (isCurrentlyFlipped) {
              e.currentTarget.classList.remove("flipped");
              if (badge) badge.textContent = "flare";
            } else {
              e.currentTarget.classList.add("flipped");
              if (badge) badge.textContent = "original";
            }
          });
        } else {
          imageElement.addEventListener("mouseenter", (e) => {
            e.currentTarget.classList.add("hovered");
            const badge = e.currentTarget.querySelector(".enhancement-badge");
            if (badge) badge.textContent = "";
          });
          imageElement.addEventListener("mouseleave", (e) => {
            e.currentTarget.classList.remove("hovered");
            const badge = e.currentTarget.querySelector(".enhancement-badge");
            if (badge) badge.textContent = "flare";
          });
        }

        track.appendChild(imageElement);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (topRowTimeoutRef.current) clearTimeout(topRowTimeoutRef.current);
      if (bottomRowTimeoutRef.current) clearTimeout(bottomRowTimeoutRef.current);
    };
  }, []);

  const topRowImages = [
    { id: 1, after: "/images/img1_after.png", before: "/images/img1_before.jpg" },
    { id: 2, after: "/images/img2_after.png", before: "/images/img2_before.jpg" },
    { id: 3, after: "/images/img3_after.png", before: "/images/img3_before.jpg" },
    { id: 8, after: "/images/img8_after.png", before: "/images/img8_before.jpg" },
    { id: 9, after: "/images/img9_after.png", before: "/images/img9_before.jpg" },
    { id: 11, after: "/images/img11_after.png", before: "/images/img11_before.jpg" },
  ];

  const bottomRowImages = [
    { id: 4, after: "/images/img4_after.png", before: "/images/img4_before.jpg" },
    { id: 5, after: "/images/img5_after.png", before: "/images/img5_before.jpg" },
    { id: 6, after: "/images/img6_after.png", before: "/images/img6_before.jpg" },
    { id: 7, after: "/images/img7_after.png", before: "/images/img7_before.jpg" },
    { id: 10, after: "/images/img10_after.png", before: "/images/img10_before.jpg" },
    { id: 12, after: "/images/img12_after.png", before: "/images/img12_before.jpg" },
  ];

  return (
    <div className="demo-container">
      <div className="nav-buttons">
        <button className="nav-button home-button" onClick={() => navigate("/")}>Home</button>
        <button className="nav-button camera-button" onClick={() => navigate("/trials")}>Trial</button>
      </div>

      <section className="gallery-section">
        <div className="gallery-wrapper">
          <div
            className={`liquid-glass-overlay ${isGalleryHovered ? "hidden" : ""}`}
            onClick={() => setIsGalleryHovered(true)}
          >
            <div className="glass-content">
              <h3 className="overlay-title">Flare Gallery</h3>
              <p className="overlay-subtitle">your photos, the way you <em>wanted</em> them to look</p>
              <p className="overlay-description">- click to continue -</p>
            </div>
          </div>

          <div
            ref={topRowRef}
            className={`scrolling-gallery-row scroll-right ${topRowPaused ? "paused" : ""}`}
            onScroll={(e) => handleScroll(e, true)}
          >
            <div className="gallery-track">
              {Array.from({ length: 20 }, (_, index) => {
                const image = topRowImages[index % topRowImages.length];
                const imageId = `top-${index}`;
                const isFlipped = flippedImages.has(imageId);
                return (
                  <div
                    key={imageId}
                    className={`gallery-item ${isFlipped ? "flipped" : ""}`}
                    onClick={isMobile ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleImageClick(imageId);
                    } : undefined}
                    onMouseEnter={!isMobile ? (e) => {
                      e.currentTarget.classList.add("hovered");
                      const badge = e.currentTarget.querySelector(".enhancement-badge");
                      if (badge) badge.textContent = "";
                    } : undefined}
                    onMouseLeave={!isMobile ? (e) => {
                      e.currentTarget.classList.remove("hovered");
                      const badge = e.currentTarget.querySelector(".enhancement-badge");
                      if (badge) badge.textContent = "flare";
                    } : undefined}
                  >
                    <div className="image-container">
                      <img src={image.before} alt="Original" className="image-before" />
                      <img src={image.after} alt="Enhanced" className="image-after" />
                    </div>
                    <div className="enhancement-badge">
                      {isFlipped ? "original" : "flare"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            ref={bottomRowRef}
            className={`scrolling-gallery-row scroll-left ${bottomRowPaused ? "paused" : ""}`}
            onScroll={(e) => handleScroll(e, false)}
          >
            <div className="gallery-track">
              {Array.from({ length: 20 }, (_, index) => {
                const image = bottomRowImages[index % bottomRowImages.length];
                const imageId = `bottom-${index}`;
                const isFlipped = flippedImages.has(imageId);
                return (
                  <div
                    key={imageId}
                    className={`gallery-item ${isFlipped ? "flipped" : ""}`}
                    onClick={isMobile ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleImageClick(imageId);
                    } : undefined}
                    onMouseEnter={!isMobile ? (e) => {
                      e.currentTarget.classList.add("hovered");
                      const badge = e.currentTarget.querySelector(".enhancement-badge");
                      if (badge) badge.textContent = "";
                    } : undefined}
                    onMouseLeave={!isMobile ? (e) => {
                      e.currentTarget.classList.remove("hovered");
                      const badge = e.currentTarget.querySelector(".enhancement-badge");
                      if (badge) badge.textContent = "flare";
                    } : undefined}
                  >
                    <div className="image-container">
                      <img src={image.before} alt="Original" className="image-before" />
                      <img src={image.after} alt="Enhanced" className="image-after" />
                    </div>
                    <div className="enhancement-badge">
                      {isFlipped ? "original" : "flare"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DemoGallery;
