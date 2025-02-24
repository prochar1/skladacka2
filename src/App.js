import React, { useState, useEffect, useRef } from 'react';

const config = window.config;
const TOTAL_TIME = config.timeout; // celkový časový limit
const IMAGE_URL = config.imageUrl; // URL obrázku – nastavíte v config

// Definujeme velikost jednoho čtverce v mřížce
const gridSize = config.piecesCols; // počet sloupců i řádků
const cellWidth = config.width / gridSize;
const cellHeight = config.height / gridSize;
const snapTolerance = 50; // tolerance v pixelech pro přichycování dílků

// Funkce, která vygeneruje dílky – směs čtvercových (monomino) a obdélníkových (domino)
function generatePieces() {
  const pieces = [];
  let id = 0;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      pieces.push({
        id: id++,
        shape: 'square',
        cell: { row, col },
        correctPos: { x: col * cellWidth, y: row * cellHeight },
        size: { width: cellWidth, height: cellHeight },
        currentPos: { x: col * cellWidth, y: row * cellHeight },
        snapped: false,
        dragOffset: null,
      });
    }
  }
  return pieces;
}

function App() {
  const [gamePhase, setGamePhase] = useState('showImage'); // 'showImage', 'playing', 'completed', 'failed'
  const [pieces, setPieces] = useState([]);
  const [timer, setTimer] = useState(TOTAL_TIME);
  const timerRef = useRef(null);
  const firstMove = useRef(false);

  useEffect(() => {
    if (gamePhase === 'showImage') {
      const timeout = setTimeout(() => {
        // Inicializace dílků sestavených podle správných pozic
        setPieces(generatePieces());
        setGamePhase('playing');
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [gamePhase]);

  // Rozpustí obrázek animací – nastaví currentPos na náhodná místa.
  useEffect(() => {
    if (gamePhase === 'playing') {
      const offsetX = (window.innerWidth - config.width) / 2;
      const offsetY = (window.innerHeight - config.height) / 2;
      const scatterMinX = -offsetX;
      const scatterMinY = -offsetY;
      const scatterMaxX = config.width + offsetX;
      const scatterMaxY = config.height + offsetY;
      setTimeout(() => {
        setPieces((prev) =>
          prev.map((p) => ({
            ...p,
            currentPos: {
              x:
                Math.random() * (scatterMaxX - scatterMinX - p.size.width) +
                scatterMinX,
              y:
                Math.random() * (scatterMaxY - scatterMinY - p.size.height) +
                scatterMinY,
            },
          }))
        );
      }, 500);
    }
  }, [gamePhase]);

  // Spouští timer po prvním tahu
  useEffect(() => {
    if (gamePhase === 'playing' && firstMove.current && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            setGamePhase('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gamePhase]);

  // Úprava vyhodnocení výhry – hra je kompletní, pokud jsou všechny dílky
  // nasnapnuté a umístěné do své původní buňky.
  useEffect(() => {
    if (
      gamePhase === 'playing' &&
      pieces.length > 0 &&
      pieces.every(
        (p) =>
          p.snapped &&
          p.currentPos.x === p.correctPos.x &&
          p.currentPos.y === p.correctPos.y
      )
    ) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setGamePhase('completed');
    }
  }, [pieces, gamePhase]);

  const handleDragStart = (e, id) => {
    if (!firstMove.current) {
      firstMove.current = true;
      if (gamePhase === 'playing' && !timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              timerRef.current = null;
              setGamePhase('failed');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const offsetX = (window.innerWidth - config.width) / 2;
    const offsetY = (window.innerHeight - config.height) / 2;
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              // Uvolníme dílek, aby bylo možno jej znovu umístit
              snapped: false,
              dragOffset: {
                x: clientX - (offsetX + p.currentPos.x),
                y: clientY - (offsetY + p.currentPos.y),
              },
            }
          : p
      )
    );
  };

  const handleDragMove = (e, id) => {
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const offsetX = (window.innerWidth - config.width) / 2;
    const offsetY = (window.innerHeight - config.height) / 2;
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped && p.dragOffset) {
          let absX = clientX - p.dragOffset.x;
          let absY = clientY - p.dragOffset.y;
          absX = Math.max(0, Math.min(absX, window.innerWidth - p.size.width));
          absY = Math.max(
            0,
            Math.min(absY, window.innerHeight - p.size.height)
          );
          return {
            ...p,
            currentPos: {
              x: absX - offsetX,
              y: absY - offsetY,
            },
          };
        }
        return p;
      })
    );
  };

  const handleDragEnd = (e, id) => {
    e.preventDefault();
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === id && !p.snapped) {
          // const offsetX = (window.innerWidth - config.width) / 2;
          // const offsetY = (window.innerHeight - config.height) / 2;
          // Spočítáme cílovou buňku na mřížce z aktuální pozice dílku
          let col = Math.round(p.currentPos.x / cellWidth);
          let row = Math.round(p.currentPos.y / cellHeight);
          // Zajistíme, že sloupec/řada spadá do platného rozsahu
          col = Math.max(0, Math.min(col, gridSize - 1));
          row = Math.max(0, Math.min(row, gridSize - 1));
          const snappedPos = { x: col * cellWidth, y: row * cellHeight };

          // Vypočítáme rozdíly mezi aktuální a snapovanou pozicí
          const diffX = Math.abs(p.currentPos.x - snappedPos.x);
          const diffY = Math.abs(p.currentPos.y - snappedPos.y);

          // Pokud je dílek dost blízko, dle snapTolerance, zkusíme ho nasnapovat.
          if (diffX <= snapTolerance && diffY <= snapTolerance) {
            // Zjistíme, zda jsou v cílové buňce již nějaký dílek
            const cellOccupied = prev.some(
              (other) =>
                other.id !== id &&
                other.snapped &&
                other.currentPos.x === snappedPos.x &&
                other.currentPos.y === snappedPos.y
            );
            if (!cellOccupied) {
              return {
                ...p,
                currentPos: snappedPos,
                snapped: true,
                dragOffset: null,
                error: false,
                instantSnap: true,
              };
            } else {
              return {
                ...p,
                dragOffset: null,
                error: true,
                instantSnap: true,
              };
            }
          }
          // Pokud dílek není v toleranci, ukončíme drag a necháme aktuální pozici.
          return { ...p, dragOffset: null };
        }
        return p;
      })
    );

    setTimeout(() => {
      setPieces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, error: false } : p))
      );
    }, 1000);

    setTimeout(() => {
      setPieces((prev) =>
        prev.map((p) => (p.id === id ? { ...p, instantSnap: false } : p))
      );
    }, 50);
  };

  const restartGame = () => {
    setGamePhase('showImage');
    setTimer(TOTAL_TIME);
    firstMove.current = false;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPieces([]);
  };

  return (
    <div
      style={{
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
      }}
    >
      {gamePhase === 'showImage' && (
        <div
          style={{
            width: config.width,
            height: config.height,
            margin: '0 auto',
            backgroundImage: `url(${IMAGE_URL})`,
            backgroundSize: 'cover',
          }}
        />
      )}

      {gamePhase === 'playing' && (
        <div
          id="image"
          style={{
            position: 'relative',
            width: config.width,
            height: config.height,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: config.width,
              height: config.height,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
              opacity: 0,
            }}
          />
          {pieces
            .filter((p) => p && p.size)
            .map((piece) => (
              <div
                key={piece.id}
                className={`piece piece-${piece.shape}`}
                style={{
                  position: 'absolute',
                  width: piece.size.width,
                  height: piece.size.height,
                  left: piece.currentPos.x,
                  top: piece.currentPos.y,
                  touchAction: 'none',
                  cursor: 'grab',
                  transition:
                    piece.dragOffset || piece.instantSnap
                      ? 'none'
                      : 'left 1s ease, top 1s ease',
                  zIndex: piece.snapped ? 0 : piece.dragOffset ? 100 : 1,
                  border: `${config.border || 5}px solid black`,
                  boxSizing: 'border-box',
                }}
                onMouseDown={(e) => handleDragStart(e, piece.id)}
                onTouchStart={(e) => handleDragStart(e, piece.id)}
                onMouseMove={(e) => handleDragMove(e, piece.id)}
                onTouchMove={(e) => handleDragMove(e, piece.id)}
                onMouseUp={(e) => handleDragEnd(e, piece.id)}
                onTouchEnd={(e) => handleDragEnd(e, piece.id)}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: piece.size.width - config.border * 2,
                    height: piece.size.height - config.border * 2,
                    left: 0,
                    top: 0,
                    backgroundImage: `url(${IMAGE_URL})`,
                    backgroundSize: `${config.width}px ${config.height}px`,
                    backgroundPosition: `-${piece.correctPos.x}px -${piece.correctPos.y}px`,
                    zIndex: 1,
                    boxSizing: 'border-box',
                  }}
                ></div>
              </div>
            ))}
          <div
            style={{
              position: 'fixed',
              top: 10,
              right: 10,
            }}
          >
            Čas: {timer}s
          </div>
        </div>
      )}

      {gamePhase === 'completed' && (
        <div>
          <div
            style={{
              width: config.width,
              height: config.height,
              margin: '0 auto',
              backgroundImage: `url(${IMAGE_URL})`,
              backgroundSize: 'cover',
            }}
          />
          <p>{config.successMessage}</p>
          <button onClick={restartGame}>{config.repeatGameButton}</button>
        </div>
      )}

      {gamePhase === 'failed' && (
        <div>
          <p>{config.expireTimeoutMessage}</p>
          <button onClick={restartGame}>{config.repeatGameButton}</button>
        </div>
      )}
    </div>
  );
}

export default App;
