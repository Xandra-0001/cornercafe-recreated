import React, { useState } from 'react';
import type { CafeTable, Zone } from '../types';
import {
  Users,
  Compass,
  Lock,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check
} from 'lucide-react';

interface FloorMapProps {
  tables: CafeTable[];
  selectedTableId: string | null;
  onSelectTable?: (table: CafeTable) => void;
  partySize?: number;
  readOnly?: boolean;
  tableBookingMap?: Record<string, { guestName: string; time: string; party: number }>;
}

export const FloorMap: React.FC<FloorMapProps> = ({
  tables,
  selectedTableId,
  onSelectTable,
  partySize = 1,
  readOnly = false,
  tableBookingMap = {},
}) => {
  const [activeZoneFilter, setActiveZoneFilter] = useState<'All' | Zone>('All');
  const [hoveredTable, setHoveredTable] = useState<CafeTable | null>(null);
  const [selectedPerkFilter, setSelectedPerkFilter] = useState<string>('All');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeLandmark, setActiveLandmark] = useState<{ title: string; tag: string; desc: string } | null>(null);

  // Available tables fitting the party size
  const availableFittingTables = tables.filter((t) => t.isAvailable && t.capacity >= partySize);

  // Lowest capacity table that can fit the party size among currently open tables
  const lowestAvailableFittingCapacity = availableFittingTables.length > 0
    ? Math.min(...availableFittingTables.map((t) => t.capacity))
    : null;

  const optimalAvailableCount = lowestAvailableFittingCapacity !== null
    ? tables.filter((t) => t.isAvailable && t.capacity === lowestAvailableFittingCapacity).length
    : 0;

  // Active focus table (hovered or selected)
  const activeFocusTable = hoveredTable || tables.find((t) => t.id === selectedTableId) || null;

  const getTableStatus = (table: CafeTable) => {
    if (!table.isAvailable) {
      return { status: 'booked', label: 'Occupied / Reserved' };
    }
    if (partySize && table.capacity < partySize) {
      return { status: 'too-small', label: `Seats max ${table.capacity} (Need ${partySize} seats)` };
    }
    // Strict allocation rule
    if (lowestAvailableFittingCapacity !== null && table.capacity > lowestAvailableFittingCapacity) {
      return {
        status: 'oversized-locked',
        label: `Reserved for ${table.capacity}+ guests (${lowestAvailableFittingCapacity}-seaters available first)`
      };
    }
    if (selectedTableId === table.id) {
      return { status: 'selected', label: 'Selected Table' };
    }
    return { status: 'available', label: `Available (${table.capacity}-Top)` };
  };

  // Helper to draw chairs around tables in SVG
  const renderChairs = (table: CafeTable, isSelected: boolean, isAvailable: boolean) => {
    const chairFill = isSelected ? '#9a7936' : isAvailable ? '#5f5f5b' : '#d2d2cd';
    const chairStroke = isSelected ? '#181818' : '#292929';
    const { x, y, width, height, capacity, shape } = table;

    if (shape === 'round') {
      const radius = width / 2;
      const cx = x + radius;
      const cy = y + radius;
      return (
        <g opacity={isAvailable ? 0.95 : 0.45}>
          <circle cx={cx} cy={cy - radius - 8} r="8" fill={chairFill} stroke={chairStroke} strokeWidth="1.5" />
          <circle cx={cx} cy={cy + radius + 8} r="8" fill={chairFill} stroke={chairStroke} strokeWidth="1.5" />
        </g>
      );
    }

    if (capacity === 2) {
      return (
        <g opacity={isAvailable ? 0.95 : 0.45}>
          <rect x={x + width / 2 - 13} y={y - 9} width="26" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
          <rect x={x + width / 2 - 13} y={y + height + 2} width="26" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        </g>
      );
    }

    if (capacity === 4) {
      return (
        <g opacity={isAvailable ? 0.95 : 0.45}>
          <rect x={x + 10} y={y - 9} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
          <rect x={x + width - 34} y={y - 9} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
          <rect x={x + 10} y={y + height + 2} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
          <rect x={x + width - 34} y={y + height + 2} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        </g>
      );
    }

    // 6-seater chairs
    return (
      <g opacity={isAvailable ? 0.95 : 0.45}>
        <rect x={x + 10} y={y - 9} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        <rect x={x + width / 2 - 12} y={y - 9} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        <rect x={x + width - 34} y={y - 9} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />

        <rect x={x + 10} y={y + height + 2} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        <rect x={x + width / 2 - 12} y={y + height + 2} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
        <rect x={x + width - 34} y={y + height + 2} width="24" height="7" rx="2" fill={chairFill} stroke={chairStroke} strokeWidth="1.3" />
      </g>
    );
  };

  return (
    <div className="floor-map-shell" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Smart Capacity Allocation Rule Banner */}
      <div className="floor-map-note" style={{
        background: '#f7f4e9',
        border: '1.5px solid #e5d4a9',
        borderRadius: '3px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '14.5px',
        color: '#67552a',
        boxShadow: '0 2px 10px rgba(24,24,24,0.06)'
      }}>
        <Info size={22} style={{ flexShrink: 0, color: 'var(--amber-dk)' }} />
        <div>
          {lowestAvailableFittingCapacity === partySize || (partySize === 3 && lowestAvailableFittingCapacity === 4) ? (
            <span>
              <strong>Seating Allocation Rule:</strong> For a party of <strong>{partySize} guests</strong>, please pick from available <strong>{lowestAvailableFittingCapacity}-seater</strong> tables ({optimalAvailableCount} currently open). Larger 6-seater tables unlock automatically if all {lowestAvailableFittingCapacity}-seaters become full.
            </span>
          ) : lowestAvailableFittingCapacity !== null && lowestAvailableFittingCapacity > partySize ? (
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              ★ All {partySize}-seater tables are currently occupied! Larger {lowestAvailableFittingCapacity}-seater tables have unlocked for your party of {partySize}.
            </span>
          ) : (
            <span>
              Viewing indoor spatial seating map for a party of <strong>{partySize}</strong>.
            </span>
          )}
        </div>
      </div>

      {/* Interactive Controls Bar: Zone Switcher & Atmosphere Filters */}
      <div className="floor-map-controls" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '16px'
      }}>
        {/* Zone Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-sec)', marginRight: '4px', fontWeight: 700 }}>
            AREA FOCUS:
          </span>
          {[
            { id: 'All', label: 'All Floor' },
            { id: 'Window', label: 'Window Zone' },
            { id: 'Indoor', label: 'Indoor Salon' },
            { id: 'Patio', label: 'Garden Patio' }
          ].map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setActiveZoneFilter(z.id as any)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: activeZoneFilter === z.id ? '2px solid var(--roast)' : '1.5px solid var(--border-dk)',
                background: activeZoneFilter === z.id ? 'var(--roast)' : 'var(--cream-alt)',
                color: activeZoneFilter === z.id ? 'var(--cream)' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: activeZoneFilter === z.id ? 700 : 600,
                transition: 'all 0.15s ease'
              }}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Atmosphere Feature Filters (Interactive table illuminator) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-sec)', marginRight: '4px', fontWeight: 700 }}>
            HIGHLIGHT PERK:
          </span>
          {[
            { id: 'All', label: 'All' },
            { id: 'Natural Light', label: '☀ Sunlight' },
            { id: 'Power', label: '⚡ Power Outlet' },
            { id: 'Quiet', label: '☕ Quiet Nook' },
            { id: 'Garden', label: '🌿 Garden Patio' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPerkFilter(p.id)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '20px',
                border: selectedPerkFilter === p.id ? '1.5px solid var(--amber-dk)' : '1px solid var(--border-dk)',
                background: selectedPerkFilter === p.id ? 'var(--amber)' : 'var(--cream-alt)',
                color: selectedPerkFilter === p.id ? 'var(--roast)' : 'var(--text-sec)',
                cursor: 'pointer',
                fontWeight: selectedPerkFilter === p.id ? 700 : 500,
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--cream-alt)',
          border: '1.5px solid var(--border-dk)',
          borderRadius: '2px',
          padding: '2px'
        }}>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.15))}
            title="Zoom Out"
            style={{ padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--roast)' }}
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', padding: '0 8px', fontWeight: 700 }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.45, z + 0.15))}
            title="Zoom In"
            style={{ padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--roast)' }}
          >
            <ZoomIn size={16} />
          </button>
          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              title="Reset View"
              style={{ padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber-dk)' }}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Cafe floor plan */}
      <div className="floor-map-frame" style={{
        background: '#ffffff',
        border: '3px solid var(--roast)',
        borderRadius: '3px',
        overflow: 'hidden',
        boxShadow: '0 10px 36px rgba(24,24,24,0.10)',
        position: 'relative'
      }}>
        {/* Floor plan header */}
        <div style={{
          background: 'var(--roast)',
          color: 'var(--cream)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass size={18} color="var(--amber)" />
            <span className="heading-display" style={{ fontSize: '18px', color: '#ffffff', letterSpacing: '0.06em' }}>
              CAFE FLOOR PLAN
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
            <span>PARTY OF {partySize}</span>
            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
              ELIGIBLE: {lowestAvailableFittingCapacity ? `${lowestAvailableFittingCapacity}-SEAT TABLES` : 'NONE'}
            </span>
          </div>
        </div>

        {/* Interactive SVG Cafe Floor Layout with Zoom/Pan */}
        <div style={{ width: '100%', overflow: 'auto', background: '#ffffff', padding: '12px', position: 'relative' }}>
          <div style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
            minWidth: '840px'
          }}>
            <svg
              viewBox="0 0 900 480"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                userSelect: 'none'
              }}
            >
              <defs>
                <pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#c9c9c5" strokeWidth="1.5" />
                </pattern>
                <pattern id="lockHatch" width="10" height="10" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#d2d2cd" strokeWidth="1.2" />
                </pattern>
                <pattern id="floorGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e8e8e5" strokeWidth="0.8" />
                </pattern>
                <pattern id="patioDeck" width="16" height="16" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="16" y2="0" stroke="#e2e2de" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Base Floor Fill */}
              <rect width="900" height="480" fill="#ffffff" />
              <rect width="900" height="480" fill="url(#floorGrid)" opacity="0.6" />

              {/* Outdoor Patio Decking Area (Right side) */}
              <rect x="630" y="210" width="250" height="255" fill="#f2f2f0" rx="2" />
              <rect x="630" y="210" width="250" height="255" fill="url(#patioDeck)" opacity="0.45" />
              <line x1="630" y1="210" x2="630" y2="465" stroke="#9a7936" strokeWidth="3.5" strokeDasharray="6 4" />

              {/* Landmark: Patio Pergola */}
              <g
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveLandmark({
                  title: 'GARDEN PATIO PERGOLA',
                  tag: 'Open-Air Terrace',
                  desc: 'Covered teak deck surrounded by blooming jasmine and cedar planters, enjoying gentle garden breezes.'
                })}
                onMouseLeave={() => setActiveLandmark(null)}
              >
                <text x="755" y="236" textAnchor="middle" fill="#666662" fontSize="14" fontFamily="'Manrope', sans-serif" letterSpacing="1">
                  [ GARDEN PATIO PERGOLA ]
                </text>
              </g>

              {/* Top Window Glass Wall (Frontage onto street) */}
              <g
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveLandmark({
                  title: 'NATURAL SUNLIGHT GLASS FAÇADE',
                  tag: 'Street Frontage',
                  desc: 'Full floor-to-ceiling panoramic glass windows looking out onto neighborhood trees with warm morning sunlight.'
                })}
                onMouseLeave={() => setActiveLandmark(null)}
              >
                <rect x="25" y="16" width="590" height="16" fill="#f0f0ee" stroke="#a8a8a4" strokeWidth="2" />
                <text x="320" y="29" textAnchor="middle" fill="#62625e" fontSize="13" fontFamily="'Manrope', sans-serif" letterSpacing="1.5">
                  ═══ STREET FRONTAGE GLASS FAÇADE (FULL SUNLIGHT) ═══
                </text>
              </g>

              {/* Outer Brick Walls */}
              <line x1="25" y1="16" x2="25" y2="465" stroke="#181818" strokeWidth="6" />
              <line x1="25" y1="465" x2="160" y2="465" stroke="#181818" strokeWidth="6" />
              <line x1="240" y1="465" x2="880" y2="465" stroke="#181818" strokeWidth="6" />

              {/* Front Door Entrance with 90° Swing Arc */}
              <g
                transform="translate(160, 465)"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveLandmark({
                  title: 'MAIN GLASS ENTRANCE',
                  tag: 'Cafe Vestibule',
                  desc: 'Traditional double glass doors with brass chimes and welcoming cedar vestibule.'
                })}
                onMouseLeave={() => setActiveLandmark(null)}
              >
                <rect x="10" y="-32" width="60" height="26" fill="#292929" rx="2" />
                <text x="40" y="-14" textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="'Manrope', sans-serif" letterSpacing="0.05em">
                  WELCOME
                </text>
                <path d="M 0,0 A 70,70 0 0,1 70,-70" fill="none" stroke="#9a7936" strokeWidth="2" strokeDasharray="4 3" />
                <line x1="0" y1="0" x2="70" y2="-70" stroke="#181818" strokeWidth="3.5" />
                <text x="82" y="-6" fill="#5f5f5b" fontSize="12" fontFamily="'Manrope', sans-serif" letterSpacing="0.05em">
                  MAIN ENTRANCE ↵
                </text>
              </g>

              {/* Restrooms */}
              <g transform="translate(420, 465)">
                <rect x="0" y="-24" width="95" height="22" fill="#e8e8e5" stroke="#d2d2cd" strokeWidth="1.2" rx="2" />
                <text x="47" y="-9" textAnchor="middle" fill="#5f5f5b" fontSize="10" fontFamily="DM Sans, sans-serif" fontWeight="700">
                  RESTROOMS ⚥
                </text>
              </g>

              {/* Barista Brew Counter & Roastery Station (Top Right) */}
              <g
                transform="translate(630, 16)"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveLandmark({
                  title: 'BARISTA BREW BAR & ROASTERY',
                  tag: 'Coffee Extraction Station',
                  desc: 'Master baristas hand-crafting siphon pour-overs, flannel-filtered Nel drips, and single-origin espresso.'
                })}
                onMouseLeave={() => setActiveLandmark(null)}
              >
                <rect x="0" y="0" width="245" height="154" fill="#292929" rx="3" stroke="#181818" strokeWidth="2.5" />
                <rect x="10" y="10" width="225" height="134" fill="#181818" rx="2" />

                <text x="122" y="34" textAnchor="middle" fill="#c5a35b" fontSize="15" fontFamily="'Manrope', sans-serif" letterSpacing="0.06em">
                  BARISTA BREW BAR
                </text>

                <rect x="22" y="48" width="62" height="34" fill="#5f5f5b" rx="2" stroke="#c5a35b" strokeWidth="1" />
                <text x="53" y="69" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="DM Sans, sans-serif">
                  ESPRESSO
                </text>

                <rect x="94" y="48" width="58" height="34" fill="#5f5f5b" rx="2" stroke="#c5a35b" strokeWidth="1" />
                <text x="123" y="69" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="DM Sans, sans-serif">
                  SIPHONS
                </text>

                <rect x="162" y="48" width="62" height="34" fill="#4b4b47" rx="2" stroke="#c5a35b" strokeWidth="1" />
                <text x="193" y="69" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontFamily="DM Sans, sans-serif">
                  PASTRIES
                </text>

                <rect x="18" y="98" width="206" height="28" fill="#9a7936" rx="2" />
                <text x="121" y="117" textAnchor="middle" fill="#181818" fontSize="13" fontFamily="'Manrope', sans-serif" letterSpacing="0.05em">
                  ORDER PICK-UP STATION
                </text>
              </g>

              {/* Indoor Library Bookshelf along left wall behind T10 */}
              <g
                transform="translate(25, 290)"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveLandmark({
                  title: 'CURATED ART & MONOGRAPHS LIBRARY',
                  tag: 'Bookshelf Alcove',
                  desc: 'Curated selection of coffee table books, art monographs, and architecture journals for guests to browse.'
                })}
                onMouseLeave={() => setActiveLandmark(null)}
              >
                <rect x="2" y="0" width="16" height="142" fill="#4b4b47" stroke="#181818" strokeWidth="1.5" />
                <text x="10" y="75" textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="'Manrope', sans-serif" letterSpacing="0.06em" transform="rotate(-90 10 75)">
                  CURATED ART BOOKS
                </text>
              </g>

              {/* Cedar Planter Divider */}
              <g transform="translate(620, 210)">
                <circle cx="5" cy="15" r="9" fill="#3c6b47" stroke="#181818" strokeWidth="1.2" />
                <circle cx="5" cy="75" r="9" fill="#3c6b47" stroke="#181818" strokeWidth="1.2" />
                <circle cx="5" cy="135" r="9" fill="#3c6b47" stroke="#181818" strokeWidth="1.2" />
                <circle cx="5" cy="195" r="9" fill="#3c6b47" stroke="#181818" strokeWidth="1.2" />
                <text x="17" y="110" fill="#3c6b47" fontSize="11" fontFamily="'Manrope', sans-serif" letterSpacing="0.05em" transform="rotate(90 17 110)">
                  CEDAR PLANTERS
                </text>
              </g>

              {/* Potted Ficus Plants */}
              <circle cx="45" cy="45" r="11" fill="#3c6b47" stroke="#181818" strokeWidth="1.5" />
              <circle cx="600" cy="45" r="11" fill="#3c6b47" stroke="#181818" strokeWidth="1.5" />
              <circle cx="865" cy="450" r="13" fill="#3c6b47" stroke="#181818" strokeWidth="1.5" />

              {/* Subtle area labels */}
              <text x="110" y="152" fill="#d8d8d4" fontSize="18" fontFamily="'Manrope', sans-serif" letterSpacing="0.08em">
                STREETFRONT WINDOW SALON
              </text>
              <text x="110" y="285" fill="#d8d8d4" fontSize="18" fontFamily="'Manrope', sans-serif" letterSpacing="0.08em">
                MAIN INDOOR COMMUNAL HALL
              </text>

              {/* ── RENDER SPATIAL TABLES ── */}
              {tables.map((table) => {
                const { status } = getTableStatus(table);
                const isSelected = selectedTableId === table.id;
                const isSelectable = !readOnly && (status === 'available' || status === 'selected');
                const isHovered = hoveredTable?.id === table.id;
                const bookingDetail = tableBookingMap[table.id];

                // Zone highlight filter
                const isDimmedByZone = activeZoneFilter !== 'All' && activeZoneFilter !== table.zone;

                // Perk highlight filter
                const matchPerk = selectedPerkFilter === 'All'
                  || (selectedPerkFilter === 'Natural Light' && table.features?.some(f => f.includes('Natural') || f.includes('Sunlit')))
                  || (selectedPerkFilter === 'Power' && table.features?.some(f => f.includes('Power')))
                  || (selectedPerkFilter === 'Quiet' && table.features?.some(f => f.includes('Quiet') || f.includes('Reading')))
                  || (selectedPerkFilter === 'Garden' && table.zone === 'Patio');

                const isDimmedByPerk = !matchPerk;

                // Color choices
                let tableFill = '#ffffff';
                let tableStroke = '#181818';
                let textMain = '#181818';
                let textSub = '#5f5f5b';

                if (isSelected) {
                  tableFill = '#c5a35b'; // Warm Amber
                  tableStroke = '#181818';
                  textMain = '#181818';
                  textSub = '#181818';
                } else if (status === 'oversized-locked') {
                  tableFill = '#f1f1ee';
                  tableStroke = '#b6b6b1';
                  textMain = '#696964';
                  textSub = '#92928d';
                } else if (status === 'booked' || status === 'too-small') {
                  tableFill = '#e8e8e5';
                  tableStroke = '#c9c9c5';
                  textMain = '#777772';
                  textSub = '#999994';
                }

                return (
                  <g
                    key={table.id}
                    onClick={() => {
                      if (isSelectable && onSelectTable) {
                        onSelectTable(table);
                      }
                    }}
                    onMouseEnter={() => setHoveredTable(table)}
                    onMouseLeave={() => setHoveredTable(null)}
                    style={{
                      cursor: isSelectable ? 'pointer' : 'not-allowed',
                      transition: 'transform 0.15s ease, opacity 0.2s ease',
                      opacity: (isDimmedByZone || isDimmedByPerk) ? 0.22 : 1
                    }}
                  >
                    {/* Surrounding Chairs */}
                    {renderChairs(table, isSelected, isSelectable)}

                    {/* Table Surface Shape */}
                    {table.shape === 'round' ? (
                      <circle
                        cx={table.x + table.width / 2}
                        cy={table.y + table.height / 2}
                        r={table.width / 2}
                        fill={tableFill}
                        stroke={tableStroke}
                        strokeWidth={isSelected ? '3.2' : isHovered ? '2.5' : status === 'oversized-locked' ? '1.8' : '2'}
                        strokeDasharray={status === 'oversized-locked' ? '4 2' : 'none'}
                        filter={isSelected ? 'drop-shadow(0 4px 10px rgba(24,24,24,0.22))' : isHovered ? 'drop-shadow(0 2px 8px rgba(197,163,91,0.28))' : 'none'}
                      />
                    ) : (
                      <rect
                        x={table.x}
                        y={table.y}
                        width={table.width}
                        height={table.height}
                        rx="4"
                        fill={tableFill}
                        stroke={tableStroke}
                        strokeWidth={isSelected ? '3.2' : isHovered ? '2.5' : status === 'oversized-locked' ? '1.8' : '2'}
                        strokeDasharray={status === 'oversized-locked' ? '4 2' : 'none'}
                        filter={isSelected ? 'drop-shadow(0 4px 10px rgba(24,24,24,0.22))' : isHovered ? 'drop-shadow(0 2px 8px rgba(197,163,91,0.28))' : 'none'}
                      />
                    )}

                    {/* Hatched pattern overlays */}
                    {status === 'booked' && (
                      table.shape === 'round' ? (
                        <circle cx={table.x + table.width / 2} cy={table.y + table.height / 2} r={table.width / 2} fill="url(#diagonalHatch)" opacity="0.35" />
                      ) : (
                        <rect x={table.x} y={table.y} width={table.width} height={table.height} rx="4" fill="url(#diagonalHatch)" opacity="0.35" />
                      )
                    )}

                    {status === 'oversized-locked' && (
                      table.shape === 'round' ? (
                        <circle cx={table.x + table.width / 2} cy={table.y + table.height / 2} r={table.width / 2} fill="url(#lockHatch)" opacity="0.4" />
                      ) : (
                        <rect x={table.x} y={table.y} width={table.width} height={table.height} rx="4" fill="url(#lockHatch)" opacity="0.4" />
                      )
                    )}

                    {/* Table label */}
                    <text
                      x={table.x + table.width / 2}
                      y={table.y + table.height / 2 - 2}
                      textAnchor="middle"
                      fill={textMain}
                      fontSize={isSelected ? '18' : '17'}
                      fontFamily="'Manrope', sans-serif"
                      letterSpacing="0.04em"
                    >
                      {table.id}
                    </text>

                    {/* Capacity or Status Subtext */}
                    <text
                      x={table.x + table.width / 2}
                      y={table.y + table.height / 2 + 14}
                      textAnchor="middle"
                      fill={textSub}
                      fontSize="10.5"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight={isSelected ? '700' : '700'}
                    >
                      {status === 'booked'
                        ? 'TAKEN'
                        : status === 'too-small'
                        ? `${table.capacity}P MAX`
                        : status === 'oversized-locked'
                        ? `LOCKED (${table.capacity}P)`
                        : `${table.capacity}-TOP`}
                    </text>

                    {/* Checkmark badge if selected */}
                    {isSelected && (
                      <g transform={`translate(${table.x + table.width - 5}, ${table.y - 3})`}>
                        <circle cx="0" cy="0" r="10" fill="#181818" />
                        <text x="0" y="4" textAnchor="middle" fill="#c5a35b" fontSize="12" fontWeight="700">
                          ✓
                        </text>
                      </g>
                    )}

                    {/* Admin mode booking time ribbon */}
                    {bookingDetail && (
                      <g transform={`translate(${table.x + table.width / 2 - 28}, ${table.y + table.height - 3})`}>
                        <rect width="56" height="13" fill="#181818" rx="2" />
                        <text x="28" y="10" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontFamily="DM Sans, sans-serif">
                          {bookingDetail.time}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Interactive Landmark Explorer Banner (If landmark is hovered) */}
        {activeLandmark && (
          <div style={{
            background: 'var(--roast)',
            color: 'var(--cream)',
            padding: '12px 24px',
            borderTop: '2px solid var(--amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            fontSize: '13.5px'
          }}>
            <div>
              <strong className="heading-display" style={{ color: 'var(--amber)', fontSize: '16px' }}>
                {activeLandmark.title}
              </strong>
              <span style={{ marginLeft: '12px', opacity: 0.9 }}>{activeLandmark.desc}</span>
            </div>
            <span style={{ fontSize: '11px', background: 'var(--amber)', color: 'var(--roast)', padding: '2px 8px', borderRadius: '2px', fontWeight: 700 }}>
              {activeLandmark.tag}
            </span>
          </div>
        )}

        {/* Selected table details */}
        <div style={{
          background: '#f4f4f2',
          borderTop: '2.5px solid var(--roast)',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          {activeFocusTable ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
              <div style={{
                background: selectedTableId === activeFocusTable.id ? 'var(--amber)' : 'var(--roast)',
                color: selectedTableId === activeFocusTable.id ? 'var(--roast)' : 'var(--cream)',
                fontFamily: 'var(--font-heading)',
                fontSize: '17px',
                letterSpacing: '0.04em',
                padding: '6px 16px',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <Users size={16} />
                <span>TABLE {activeFocusTable.id}</span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="heading-display" style={{ fontSize: '18px', color: 'var(--roast)' }}>
                    {activeFocusTable.name} ({activeFocusTable.zone} Section · {activeFocusTable.capacity}-Top)
                  </span>
                  {(() => {
                    const { status, label } = getTableStatus(activeFocusTable);
                    if (status === 'oversized-locked') {
                      return (
                        <span style={{
                          background: '#f7f4e9',
                          color: '#8a6b29',
                          fontSize: '11px',
                          padding: '3px 8px',
                          border: '1px solid #e5d4a9',
                          borderRadius: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700
                        }}>
                          <Lock size={12} /> {label}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span style={{ fontSize: '13.5px', color: 'var(--text-sec)', display: 'block', marginTop: '3px' }}>
                  {activeFocusTable.description}
                </span>
              </div>

              {activeFocusTable.features && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeFocusTable.features.map((f) => (
                    <span key={f} style={{
                      fontSize: '11.5px',
                      background: 'var(--cream)',
                      border: '1px solid var(--border-dk)',
                      padding: '3px 10px',
                      borderRadius: '2px',
                      color: 'var(--roast)',
                      fontWeight: 600
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: 'var(--text-sec)', fontStyle: 'italic' }}>
              Choose a table to see its capacity and seating features.
            </div>
          )}

          {/* Current Selection Status Pill & Quick Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeFocusTable && getTableStatus(activeFocusTable).status === 'available' && !readOnly && onSelectTable && (
              <button
                type="button"
                onClick={() => onSelectTable(activeFocusTable)}
                className="btn btn-amber"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Select Table {activeFocusTable.id}
              </button>
            )}

            {selectedTableId ? (
              <span style={{
                background: '#d4edda',
                color: 'var(--success)',
                fontWeight: 700,
                fontSize: '13.5px',
                padding: '8px 16px',
                borderRadius: '2px',
                border: '1.5px solid #bce2c6',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Check size={18} strokeWidth={2.5} /> Table {selectedTableId} Selected for Party of {partySize}
              </span>
            ) : (
              <span style={{ fontSize: '13.5px', color: 'var(--amber-dk)', fontWeight: 700 }}>
                Please select an available {lowestAvailableFittingCapacity ? `${lowestAvailableFittingCapacity}-seater` : 'table'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Accessible Table List Accordion Fallback */}
      <details style={{ marginTop: '2px', fontSize: '13.5px', color: 'var(--text-sec)' }}>
        <summary style={{ cursor: 'pointer', outline: 'none', userSelect: 'none', padding: '6px 0', fontWeight: 700 }}>
          Accessible Seating Index &amp; Capacity Table
        </summary>
        <div style={{
          marginTop: '8px',
          background: 'var(--cream)',
          border: '1.5px solid var(--border)',
          borderRadius: '2px',
          padding: '16px',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-dk)', color: 'var(--roast)' }}>
                <th style={{ padding: '8px 6px' }}>Table No.</th>
                <th style={{ padding: '8px 6px' }}>Name &amp; Location</th>
                <th style={{ padding: '8px 6px' }}>Zone</th>
                <th style={{ padding: '8px 6px' }}>Capacity</th>
                <th style={{ padding: '8px 6px' }}>Status</th>
                {!readOnly && <th style={{ padding: '8px 6px' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => {
                const { status, label } = getTableStatus(t);
                const isSelected = selectedTableId === t.id;
                const canSelect = !readOnly && (status === 'available' || status === 'selected');

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 6px', fontFamily: 'var(--font-heading)', fontSize: '16px', letterSpacing: '0.04em' }}>{t.id}</td>
                    <td style={{ padding: '8px 6px' }}>{t.name}</td>
                    <td style={{ padding: '8px 6px' }}>{t.zone}</td>
                    <td style={{ padding: '8px 6px' }}>Up to {t.capacity} Guests</td>
                    <td style={{
                      padding: '8px 6px',
                      color: isSelected ? 'var(--amber-dk)' : status === 'oversized-locked' ? '#8a6b29' : 'inherit',
                      fontWeight: isSelected ? 700 : 500
                    }}>
                      {label}
                    </td>
                    {!readOnly && (
                      <td style={{ padding: '8px 6px' }}>
                        {canSelect ? (
                          <button
                            type="button"
                            onClick={() => onSelectTable && onSelectTable(t)}
                            style={{
                              padding: '5px 14px',
                              fontSize: '11.5px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              background: isSelected ? 'var(--amber)' : 'var(--roast)',
                              color: isSelected ? 'var(--roast)' : 'var(--cream)',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? 'Selected' : 'Pick'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-sec)' }}>
                            {status === 'oversized-locked' ? 'Locked' : '—'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
