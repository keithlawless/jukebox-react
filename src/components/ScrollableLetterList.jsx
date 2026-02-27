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
  const [scrollLetter, setScrollLetter] = useState('');

  const labels = useMemo(() => items.map((item) => getItemLabel(item)), [items, getItemLabel]);

  const updateLetterFromScroll = () => {
    const container = containerRef.current;
    if (!container || labels.length === 0) {
      return;
    }

    const itemHeight = container.firstElementChild?.getBoundingClientRect().height ?? 40;
    const index = Math.min(Math.floor(container.scrollTop / itemHeight), labels.length - 1);
    setScrollLetter(firstLetter(labels[index]));
  };

  return (
    <section className="list-column">
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
        {scrollLetter ? <div className="scroll-tooltip">{scrollLetter}</div> : null}
      </div>
    </section>
  );
}

export default ScrollableLetterList;
