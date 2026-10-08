import React from 'react'
import './Skeleton.css'

/**
 * Base primitive Skeleton component for loading states.
 * 
 * @param {Object} props
 * @param {'text' | 'circular' | 'rectangular' | 'card' | 'pill'} props.variant
 * @param {string} props.width
 * @param {string} props.height
 * @param {string} props.className
 * @param {Object} props.style
 */
export const Skeleton = ({ variant = 'text', width, height, className = '', style = {} }) => {
  const variantClass = `skeleton-${variant}`
  const computedStyle = { ...style }
  if (width) computedStyle.width = width
  if (height) computedStyle.height = height

  return (
    <div
      className={`markova-skeleton ${variantClass} ${className}`}
      style={computedStyle}
      aria-hidden="true"
    />
  )
}

/**
 * Metric Cards Grid Skeleton (KPI Summary Strip)
 */
export const MetricCardsSkeleton = ({ count = 4, className = '' }) => (
  <div className={`skeleton-kpis-grid ${className}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-kpi-card">
        <div className="skeleton-kpi-top">
          <Skeleton variant="rectangular" width="38px" height="38px" style={{ borderRadius: '10px' }} />
          <Skeleton variant="pill" width="60px" height="20px" />
        </div>
        <Skeleton variant="text" width="45%" height="13px" />
        <div className="skeleton-kpi-bottom">
          <Skeleton variant="text" width="65%" height="28px" style={{ borderRadius: '6px' }} />
          <Skeleton variant="text" width="25%" height="14px" />
        </div>
      </div>
    ))}
  </div>
)

/**
 * Tab Navigation Strip Skeleton
 */
export const TabNavSkeleton = ({ count = 4, className = '' }) => (
  <div className={`skeleton-tabs-strip ${className}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={i}
        variant="rectangular"
        width={i === 0 ? '110px' : i === 1 ? '130px' : '95px'}
        height="36px"
        className="skeleton-tab-pill"
      />
    ))}
  </div>
)

/**
 * Table Skeleton with Header and Rows
 */
export const TableSkeleton = ({ rows = 5, cols = 5, hasToolbar = true, className = '' }) => (
  <div className={`skeleton-table-card ${className}`} aria-hidden="true">
    {hasToolbar && (
      <div className="skeleton-table-toolbar">
        <Skeleton variant="rectangular" width="240px" height="38px" style={{ borderRadius: '8px' }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Skeleton variant="rectangular" width="90px" height="36px" style={{ borderRadius: '8px' }} />
          <Skeleton variant="rectangular" width="100px" height="36px" style={{ borderRadius: '8px' }} />
        </div>
      </div>
    )}
    <div className="skeleton-table-head">
      {Array.from({ length: cols }).map((_, c) => (
        <Skeleton
          key={c}
          variant="text"
          width={c === 0 ? '25%' : `${Math.floor(75 / (cols - 1))}%`}
          height="14px"
        />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="skeleton-table-row">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            variant="text"
            width={c === 0 ? '30%' : c === cols - 1 ? '18%' : `${Math.floor(52 / (cols - 2))}%`}
            height="15px"
          />
        ))}
      </div>
    ))}
  </div>
)

/**
 * Cards Grid Skeleton (for Agents, Voice Channels, Integrations)
 */
export const CardGridSkeleton = ({ count = 6, className = '' }) => (
  <div className={`skeleton-cards-grid ${className}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-entity-card">
        <div className="skeleton-card-header">
          <Skeleton variant="circular" width="44px" height="44px" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Skeleton variant="text" width="60%" height="16px" />
            <Skeleton variant="text" width="35%" height="12px" />
          </div>
          <Skeleton variant="pill" width="55px" height="22px" />
        </div>
        <div className="skeleton-card-body">
          <Skeleton variant="text" width="100%" height="13px" />
          <Skeleton variant="text" width="85%" height="13px" />
        </div>
        <div className="skeleton-card-footer">
          <Skeleton variant="text" width="30%" height="14px" />
          <Skeleton variant="rectangular" width="80px" height="30px" style={{ borderRadius: '6px' }} />
        </div>
      </div>
    ))}
  </div>
)

/**
 * Chart Panel Skeleton (for Analytics & Telemetry Time Series)
 */
export const ChartSkeleton = ({ height = 260, title = true, className = '' }) => (
  <div className={`skeleton-chart-card ${className}`} aria-hidden="true">
    {title && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '220px' }}>
          <Skeleton variant="text" width="70%" height="18px" />
          <Skeleton variant="text" width="100%" height="12px" />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Skeleton variant="pill" width="75px" height="28px" />
          <Skeleton variant="pill" width="75px" height="28px" />
        </div>
      </div>
    )}
    <div className="skeleton-chart-canvas" style={{ height: `${height}px` }}>
      {[35, 60, 45, 80, 55, 90, 70, 85, 40, 65, 75, 95].map((h, idx) => (
        <div
          key={idx}
          className="skeleton-chart-bar"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  </div>
)

/**
 * Split Layout Skeleton (for Call Center Live Operations)
 */
export const CallCenterSkeleton = () => (
  <div className="skeleton-page" aria-hidden="true">
    <div className="skeleton-header">
      <div className="skeleton-header-titles">
        <Skeleton variant="text" width="220px" height="28px" />
        <Skeleton variant="text" width="340px" height="14px" />
      </div>
      <div className="skeleton-header-actions">
        <Skeleton variant="rectangular" width="120px" height="38px" style={{ borderRadius: '8px' }} />
      </div>
    </div>
    <div className="skeleton-split-layout">
      {/* Sidebar List */}
      <div className="skeleton-sidebar-panel">
        <Skeleton variant="rectangular" width="100%" height="38px" style={{ borderRadius: '8px' }} />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Skeleton variant="pill" width="60px" height="26px" />
          <Skeleton variant="pill" width="60px" height="26px" />
          <Skeleton variant="pill" width="60px" height="26px" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: '0.75rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Skeleton variant="circular" width="36px" height="36px" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Skeleton variant="text" width="70%" height="14px" />
              <Skeleton variant="text" width="45%" height="11px" />
            </div>
            <Skeleton variant="pill" width="48px" height="20px" />
          </div>
        ))}
      </div>

      {/* Main Call Monitor */}
      <div className="skeleton-main-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Skeleton variant="circular" width="42px" height="42px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Skeleton variant="text" width="160px" height="18px" />
              <Skeleton variant="text" width="100px" height="12px" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Skeleton variant="pill" width="70px" height="28px" />
            <Skeleton variant="pill" width="80px" height="28px" />
          </div>
        </div>

        {/* Audio Wave Placeholder */}
        <Skeleton variant="rectangular" width="100%" height="64px" style={{ borderRadius: '10px' }} />

        {/* Transcript Conversation Bubbles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ alignSelf: 'flex-start', width: '60%' }}>
            <Skeleton variant="rectangular" width="100%" height="52px" style={{ borderRadius: '12px' }} />
          </div>
          <div style={{ alignSelf: 'flex-end', width: '65%' }}>
            <Skeleton variant="rectangular" width="100%" height="60px" style={{ borderRadius: '12px' }} />
          </div>
          <div style={{ alignSelf: 'flex-start', width: '55%' }}>
            <Skeleton variant="rectangular" width="100%" height="48px" style={{ borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    </div>
  </div>
)

/**
 * Integration Directory Skeleton
 */
export const IntegrationGridSkeleton = () => (
  <div className="skeleton-page" aria-hidden="true">
    <div className="skeleton-header">
      <div className="skeleton-header-titles">
        <Skeleton variant="text" width="240px" height="28px" />
        <Skeleton variant="text" width="380px" height="14px" />
      </div>
      <div className="skeleton-header-actions">
        <Skeleton variant="rectangular" width="220px" height="38px" style={{ borderRadius: '8px' }} />
      </div>
    </div>
    <TabNavSkeleton count={6} />
    <CardGridSkeleton count={8} />
  </div>
)

/**
 * Universal Full-Page Skeleton
 */
export const PageSkeleton = ({
  hasKpis = true,
  kpiCount = 4,
  hasTabs = true,
  tabCount = 4,
  layout = 'table' // 'table' | 'cards' | 'chart'
}) => (
  <div className="skeleton-page" aria-hidden="true">
    {/* Page Header */}
    <div className="skeleton-header">
      <div className="skeleton-header-titles">
        <Skeleton variant="text" width="260px" height="30px" />
        <Skeleton variant="text" width="420px" height="14px" />
      </div>
      <div className="skeleton-header-actions">
        <Skeleton variant="rectangular" width="110px" height="38px" style={{ borderRadius: '8px' }} />
        <Skeleton variant="rectangular" width="130px" height="38px" style={{ borderRadius: '8px' }} />
      </div>
    </div>

    {/* Metric Cards Grid */}
    {hasKpis && <MetricCardsSkeleton count={kpiCount} />}

    {/* Tab Strip */}
    {hasTabs && <TabNavSkeleton count={tabCount} />}

    {/* Content Area */}
    {layout === 'table' && <TableSkeleton rows={6} cols={5} />}
    {layout === 'cards' && <CardGridSkeleton count={6} />}
    {layout === 'chart' && (
      <>
        <ChartSkeleton height={280} />
        <TableSkeleton rows={4} cols={6} />
      </>
    )}
  </div>
)

export default Skeleton
