import React, { useState, useEffect, useRef } from 'react';

const config = window.config;
const TOTAL_TIME = config.timeout; // celkový časový limit
const IMAGE_URL = config.imageUrl; // URL obrázku – nastavíte v config

// Definujeme velikost jednoho čtverce v mřížce
const gridSize = config.piecesCols; // počet sloupců i řádků
const cellWidth = config.width / gridSize;
const cellHeight = config.height / gridSize;
const snapTolerance = 50; // tolerance v pixelech pro přichycování dílků

const CIRCLE_RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

const confuzingImageUrl =
  config[`confuzingImageUrl${Math.random() < 0.5 ? 1 : 2}`];

// Funkce, která vygeneruje dílky – směs čtvercových (monomino) a obdélníkových (domino)
function generatePieces() {
  const pieces = [];
  let id = 0;
  // Vygenerujeme pouze správné dílky
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      pieces.push({
        id: id++,
        shape: 'square',
        isConfusion: false,
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

function generateConfusionPieces(startId, initialPos = null) {
  const confusionPieces = [];
  const numConfusionPieces = config.numConfusionPieces || 5; // počet extra dílků – dle potřeby
  for (let i = 0; i < numConfusionPieces; i++) {
    // Pro výpočet cílové scatter pozice použijeme stejné hodnoty jako níže
    const offsetX = (window.innerWidth - config.width) / 2;
    const offsetY = (window.innerHeight - config.height) / 2;
    const scatterMinX = -offsetX;
    const scatterMinY = -offsetY;
    const scatterMaxX = config.width + offsetX;
    const scatterMaxY = config.height + offsetY;
    const targetX =
      Math.random() * (scatterMaxX - scatterMinX - cellWidth) + scatterMinX;
    const targetY =
      Math.random() * (scatterMaxY - scatterMinY - cellHeight) + scatterMinY;
    // Náhodný offset pro zobrazení části obrázku confusion
    const confusionOffsetX = Math.random() * (config.width - cellWidth);
    const confusionOffsetY = Math.random() * (config.height - cellHeight);

    confusionPieces.push({
      id: startId++,
      shape: 'square',
      isConfusion: true,
      // Nemají reálnou cílovou pozici
      correctPos: { x: -999, y: -999 },
      size: { width: cellWidth, height: cellHeight },
      // Pokud byl předán initialPos, použijeme jej, jinak rovnou cílovou
      currentPos: initialPos || { x: targetX, y: targetY },
      snapped: false,
      dragOffset: null,
      confusionOffset: { x: confusionOffsetX, y: confusionOffsetY },
      // Uložíme cílovou pozici pro pozdější animaci
      targetPos: { x: targetX, y: targetY },
    });
  }
  return confusionPieces;
}

function App() {
  const [gamePhase, setGamePhase] = useState('showImage'); // 'showImage', 'playing', 'completed', 'failed'
  const [pieces, setPieces] = useState([]);
  const [timer, setTimer] = useState(TOTAL_TIME);
  const timerRef = useRef(null);
  const firstMove = useRef(false);
  const [maxZ, setMaxZ] = useState(1);

  useEffect(() => {
    if (gamePhase === 'showImage') {
      const timeout = setTimeout(() => {
        // Inicializace dílků sestavených podle správných pozic
        setPieces(generatePieces());
        setGamePhase('playing');
      }, config.showImageTimeout || 2000);
      return () => clearTimeout(timeout);
    }
  }, [gamePhase]);

  // Rozpustí obrázek animací – nastaví currentPos na náhodná místa mimo herní plochu.
  useEffect(() => {
    if (gamePhase === 'playing') {
      const offsetX = (window.innerWidth - config.width) / 2;
      const offsetY = (window.innerHeight - config.height) / 2;

      // Funkce pro získání náhodné pozice mimo herní plochu
      const getRandomPositionOutsideGameArea = (pieceWidth, pieceHeight) => {
        const margin = 20;
        const area = Math.floor(Math.random() * 2); // 0-levá, 1-pravá
        let x, y;

        // eslint-disable-next-line default-case
        switch (area) {
          case 0: // Levá oblast - vlevo od herní plochy
            x = margin;
            x = Math.max(
              margin,
              Math.random() * (offsetX - margin - pieceWidth)
            );
            y =
              margin +
              Math.random() * (window.innerHeight - pieceHeight - margin * 2);
            break;
          case 1: // Pravá oblast - vpravo od herní plochy
            x = offsetX + config.width + margin;
            x = Math.min(
              window.innerWidth - pieceWidth - margin,
              x +
                Math.random() *
                  (window.innerWidth -
                    (offsetX + config.width + margin * 2) -
                    pieceWidth)
            );
            y =
              margin +
              Math.random() * (window.innerHeight - pieceHeight - margin * 2);
            break;
        }

        return {
          x: x - offsetX,
          y: y - offsetY,
        };
      };

      // Rozházíme dílky, kromě náhodně vybraných, které budou správně umístěné
      // s malým zpožděním
      setTimeout(() => {
        setPieces((prev) => {
          // Získáme všechny neprázdné dílky (ne confusion)
          const nonConfusionPieces = prev.filter((p) => !p.isConfusion);

          // Náhodně zamícháme dílky
          const shuffledPieces = [...nonConfusionPieces].sort(
            () => Math.random() - 0.5
          );

          // Vybereme první numDonePieces dílků pro předvyplnění
          const selectedPieces = shuffledPieces.slice(0, config.numDonePieces);

          return prev.map((p) => {
            if (p.isConfusion) return p;

            // Zjistíme, zda je tento dílek mezi vybranými
            const isSelected = selectedPieces.some((sp) => sp.id === p.id);

            if (isSelected) {
              // Pokud je dílek vybraný, umístíme ho na jeho správnou pozici
              return {
                ...p,
                snapped: true,
                currentPos: p.correctPos, // použijeme správnou pozici dílku
              };
            }

            // Ostatní dílky rozházíme
            return {
              ...p,
              currentPos: getRandomPositionOutsideGameArea(
                p.size.width,
                p.size.height
              ),
            };
          });
        });
      }, 50); // Zpoždění 50ms
      // Zbytek kódu pro confusion dílky zůstává stejný
      const centerPos = {
        x: config.width / 2 - cellWidth / 2,
        y: config.height / 2 - cellHeight / 2,
      };
      setPieces((prev) => {
        const startId = prev.length;
        const confusion = generateConfusionPieces(startId, centerPos);
        return [...prev, ...confusion];
      });

      // Po krátkém zpoždění rozházíme i confusion dílky mimo herní plochu
      setTimeout(() => {
        setPieces((prev) =>
          prev.map((p) =>
            p.isConfusion
              ? {
                  ...p,
                  currentPos: getRandomPositionOutsideGameArea(
                    p.size.width,
                    p.size.height
                  ),
                }
              : p
          )
        );
      }, 200);
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
      pieces
        .filter((p) => !p.isConfusion)
        .every(
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

    // Zvýšíme maxZ a nastavíme novou hodnotu i danému dílku
    const newZ = maxZ + 1;
    setMaxZ(newZ);

    setPieces((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              snapped: false,
              // Nastavíme dragOffset stejně jako dříve
              dragOffset: {
                x: clientX - (offsetX + p.currentPos.x),
                y: clientY - (offsetY + p.currentPos.y),
              },
              instantSnap: true,
              // Při startu tažení aktualizujeme zIndex
              zIndex: newZ,
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
          let col = Math.round(p.currentPos.x / cellWidth);
          let row = Math.round(p.currentPos.y / cellHeight);
          col = Math.max(0, Math.min(col, gridSize - 1));
          row = Math.max(0, Math.min(row, gridSize - 1));
          const snappedPos = { x: col * cellWidth, y: row * cellHeight };
          const diffX = Math.abs(p.currentPos.x - snappedPos.x);
          const diffY = Math.abs(p.currentPos.y - snappedPos.y);

          const cellOccupied = prev.some(
            (other) =>
              other.id !== id &&
              other.snapped &&
              other.currentPos.x === snappedPos.x &&
              other.currentPos.y === snappedPos.y
          );
          if (
            diffX <= snapTolerance &&
            diffY <= snapTolerance &&
            !cellOccupied
          ) {
            // Pokud je úspěšně snapnutý, nastavíme zIndex na 0
            return {
              ...p,
              currentPos: snappedPos,
              snapped: true,
              dragOffset: null,
              error: false,
              instantSnap: true,
              zIndex: 0,
            };
          } else {
            return { ...p, dragOffset: null };
          }
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
    setMaxZ(1);
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
          id="preimage"
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
              opacity: 0.1,
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
                  // Pokud je snapnutý, používáme 0, jinak zIndex uložený v objektu, nebo default 1
                  zIndex: piece.snapped ? 0 : piece.zIndex || 1,
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
                    backgroundImage: `url(${
                      piece.isConfusion ? confuzingImageUrl : IMAGE_URL
                    })`,
                    backgroundSize: `${config.width}px ${config.height}px`,
                    backgroundPosition: piece.isConfusion
                      ? `-${piece.confusionOffset.x}px -${piece.confusionOffset.y}px`
                      : `-${piece.correctPos.x}px -${piece.correctPos.y}px`,
                    zIndex: 1,
                    boxSizing: 'border-box',
                  }}
                ></div>
              </div>
            ))}
          <div className="timer-container">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="8"
                className="timer-circle-background"
              />
              <circle
                cx="50"
                cy="50"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="#3f51b5"
                strokeWidth="8"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (timer / TOTAL_TIME)}
                transform="rotate(-90 50 50)"
                className="timer-circle"
              />
              <text
                x="50"
                y="55"
                textAnchor="middle"
                fontSize="18"
                fill="#000"
                className="timer-text"
              >
                {timer}s
              </text>
            </svg>
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
