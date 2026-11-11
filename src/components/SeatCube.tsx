import { useState, type CSSProperties } from 'react';
import { Armchair, ChevronLeft, ChevronRight, Flower2, RotateCw, Sun } from 'lucide-react';
import type { CafeTable } from '../types';
import './seat-cube.css';

interface SeatCubeProps {
  tables: CafeTable[];
  selectedTableId: string | null;
  onSelectTable: (table: CafeTable) => void;
  partySize: number;
}

const floors = [
  { floor: 1, label: 'Window', subtitle: 'Streetfront windows', Icon: Sun },
  { floor: 2, label: 'Indoor', subtitle: 'Main cafe salon', Icon: Armchair },
  { floor: 3, label: 'Patio', subtitle: 'Garden terrace', Icon: Flower2 },
] as const;

const cubeSides = ['Front', 'Right side', 'Opposite'] as const;

function getTableMessage(table: CafeTable, selectedTableId: string | null, lowestCapacity: number | null) {
  if (!table.isAvailable) return 'Fully booked today';
  if (table.capacity < 1) return 'Unavailable';
  if (selectedTableId === table.id) return 'Selected';
  if (lowestCapacity !== null && table.capacity > lowestCapacity) return 'Held for larger parties';
  return 'Available';
}

export function SeatCube({ tables, selectedTableId, onSelectTable, partySize }: SeatCubeProps) {
  const [side, setSide] = useState(0);
  const fittingOpenTables = tables.filter((table) => table.isAvailable && table.capacity >= partySize);
  const lowestCapacity = fittingOpenTables.length
    ? Math.min(...fittingOpenTables.map((table) => table.capacity))
    : null;

  const rotate = (direction: number) => setSide((current) => (current + direction + cubeSides.length) % cubeSides.length);
  const buildingStyle = { '--cube-turn': `${side * -120}deg` } as CSSProperties;

  return (
    <section className="seat-cube-picker" aria-label="Choose a table on one of three floors">
      <div className="seat-cube-picker__topline">
        <div className="seat-cube-picker__legend" aria-label="Table key">
          <span><i className="is-available" /> Available</span>
          <span><i className="is-selected" /> Selected</span>
          <span><i className="is-unavailable" /> Unavailable</span>
        </div>
        <p>Showing <strong>27 tables</strong> for <strong>{partySize} {partySize === 1 ? 'guest' : 'guests'}</strong></p>
      </div>

      <div className="seat-cube-picker__controls" aria-label="Rotate table view">
        <button type="button" className="seat-cube-picker__arrow" onClick={() => rotate(-1)} aria-label="Rotate cube to the previous side">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="seat-cube-picker__side-label" aria-live="polite">
          <span className="eyebrow">CUBE VIEW {side + 1} OF 3</span>
          <strong>{cubeSides[side]}</strong>
        </div>
        <button type="button" className="seat-cube-picker__turn" onClick={() => rotate(1)}>
          <RotateCw size={16} aria-hidden="true" /> Rotate cube
        </button>
        <button type="button" className="seat-cube-picker__arrow" onClick={() => rotate(1)} aria-label="Rotate cube to the next side">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="seat-cube-scene" aria-label={`Three floor table cube, ${cubeSides[side]} view`}>
        <div className="seat-cube-building" style={buildingStyle}>
          {floors.map(({ floor, label, subtitle, Icon }) => {
            const floorTables = tables
              .filter((table) => table.floor === floor)
              .sort((a, b) => Number(a.id.replace('T', '')) - Number(b.id.replace('T', '')));
            const floorOpenCount = floorTables.filter((table) =>
              table.isAvailable && table.capacity >= partySize
              && (lowestCapacity === null || table.capacity <= lowestCapacity)
            ).length;

            return (
              <section className="seat-cube-floor" key={floor} aria-label={`Floor ${floor}, ${label}`}>
                {[0, 1, 2].map((faceIndex) => {
                  const faceTables = floorTables.slice(faceIndex * 3, faceIndex * 3 + 3);
                  const isActiveFace = faceIndex === side;
                  return (
                    <div
                      className={`seat-cube-floor__face seat-cube-floor__face--${faceIndex}`}
                      key={`${floor}-${faceIndex}`}
                      aria-hidden={!isActiveFace}
                    >
                      <header className="seat-cube-floor__header">
                        <span className="seat-cube-floor__icon"><Icon size={17} aria-hidden="true" /></span>
                        <div className="seat-cube-floor__heading">
                          <span>FLOOR 0{floor} · {subtitle}</span>
                          <h3>{label}</h3>
                        </div>
                        <span className="seat-cube-floor__count">{floorOpenCount} open</span>
                      </header>
                      <div className="seat-cube-floor__tables">
                        {faceTables.map((table) => {
                          const selectable = table.isAvailable && table.capacity >= partySize
                            && (lowestCapacity === null || table.capacity <= lowestCapacity);
                          const selected = selectedTableId === table.id;
                          const tableMessage = getTableMessage(table, selectedTableId, lowestCapacity);
                          return (
                            <button
                              type="button"
                              className={`seat-cube-table${selected ? ' is-selected' : ''}${!selectable ? ' is-locked' : ''}`}
                              key={table.id}
                              disabled={!selectable}
                              tabIndex={isActiveFace && selectable ? 0 : -1}
                              aria-pressed={selected}
                              aria-label={`${table.id}, ${label} floor, seats ${table.capacity}, ${tableMessage}`}
                              onClick={() => onSelectTable(table)}
                              title={`${table.id} · ${table.name} · ${table.capacity} seats · ${tableMessage}`}
                            >
                              <span className="seat-cube-table__sheen" aria-hidden="true" />
                              <span className="seat-cube-table__number">{table.id}</span>
                              <span className="seat-cube-table__name">{table.name}</span>
                              <span className="seat-cube-table__meta">{table.capacity} seats · {tableMessage}</span>
                            </button>
                          );
                        })}
                      </div>
                      <span className="seat-cube-floor__side-label" aria-hidden="true">{cubeSides[faceIndex]}</span>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
