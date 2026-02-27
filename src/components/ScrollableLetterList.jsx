import { useMemo, useRef, useState } from 'react';

function firstLetter(text) {
  if (!text || typeof text !== 'string') {
    return '#';
  }

  return text.trim().charAt(0).toUpperCase() || '#';
}

function ScrollableLetterList({
  title,
  items,
  selectedId,
  onSelect,
  emptyMessage,
  emptyContent,
  getItemLabel,
  ariaLabel,
  headerAction,
}) {
  const containerRef = useRef(null);
  const scrubberRef = useRef(null);
  const [scrollLetter, setScrollLetter] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const labels = useMemo(() => items.map((item) => getItemLabel(item)), [items, getItemLabel]);

  const letterIndexMap = useMemo(() => {
    const map = new Map();
    labels.forEach((label, index) => {
      const letter = firstLetter(label);
      if (!map.has(letter)) {
        map.set(letter, index);
      }
    });
    return map;
  }, [labels]);

  const availableLetters = useMemo(() => {
    return Array.from(letterIndexMap.keys()).sort();
  }, [letterIndexMap]);

  const updateLetterFromScroll = () => {
    const container = containerRef.current;
    if (!container || labels.length === 0) {
      return;
    }

    const itemHeight = container.firstElementChild?.getBoundingClientRect().height ?? 40;
    const index = Math.min(Math.floor(container.scrollTop / itemHeight), labels.length - 1);
    setScrollLetter(firstLetter(labels[index]));
  };

  const scrollToLetter = (letter) => {
    const container = containerRef.current;
    if (!container || !letterIndexMap.has(letter)) {
      return;
    }

    const index = letterIndexMap.get(letter);
    const itemHeight = container.firstElementChild?.getBoundingClientRect().height ?? 40;
    container.scrollTop = index * itemHeight;
    setScrollLetter(letter);
  };

  const handleScrubberInteraction = (clientY) => {
    const scrubber = scrubberRef.current;
    const container = containerRef.current;
    if (!scrubber || !container || availableLetters.length === 0) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const relativeY = clientY - containerRect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / containerRect.height));
    const letterIndex = Math.floor(percentage * availableLetters.length);
    const targetLetter = availableLetters[Math.min(letterIndex, availableLetters.length - 1)];
    
    scrollToLetter(targetLetter);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    handleScrubberInteraction(e.clientY);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleScrubberInteraction(e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    handleScrubberInteraction(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches.length > 0) {
      handleScrubberInteraction(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <section 
      className="list-column"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="list-header">
        <h2>{title}</h2>
        {headerAction}
      </div>
      <div className="scroll-area-wrapper">
        <ul
          className="scroll-list"
          ref={containerRef}
          onScroll={updateLetterFromScroll}
          title={scrollLetter ? `Current letter: ${scrollLetter}` : 'Scroll through list'}
          aria-label={ariaLabel}
        >
          {items.length === 0 ? (
            <li className="empty-row">{emptyContent ?? emptyMessage}</li>
          ) : (
            items.map((item) => {
              const label = getItemLabel(item);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`list-item-button ${item.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(item)}
                  >
                    {label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {scrollLetter && items.length > 0 ? (
          <div 
            ref={scrubberRef}
            className={`scroll-tooltip ${isDragging ? 'dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="slider"
            aria-label="Letter scrubber"
            aria-valuetext={scrollLetter}
            tabIndex={0}
          >
            {scrollLetter}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default ScrollableLetterList;
