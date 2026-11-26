import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUIStore } from './uiStore';
import { api } from './apiSupabase';

export interface ColumnWidthConfig {
  [columnKey: string]: number;
}

export interface UseTableColumnResizeOptions {
  tableId: string;
  defaultWidths: ColumnWidthConfig;
  minWidth?: number;
  maxWidth?: number;
  userId?: string;
}

export function useTableColumnResize({
  tableId,
  defaultWidths,
  minWidth = 50,
  maxWidth = 800,
  userId,
}: UseTableColumnResizeOptions) {
  const enableTableColumnResize = useUIStore((s) => s.enableTableColumnResize);
  const cloudTableColumnWidths = useUIStore((s) => s.tableColumnWidths);
  const setTableColumnWidthsStore = useUIStore((s) => s.setTableColumnWidths);
  const resetTableColumnWidthsStore = useUIStore((s) => s.resetTableColumnWidths);

  // Local state initialized from store/default
  const [widths, setWidths] = useState<ColumnWidthConfig>(() => {
    const saved = cloudTableColumnWidths[tableId];
    return saved ? { ...defaultWidths, ...saved } : { ...defaultWidths };
  });

  // Keep widths in sync when store or tableId changes
  useEffect(() => {
    const saved = cloudTableColumnWidths[tableId];
    setWidths(saved ? { ...defaultWidths, ...saved } : { ...defaultWidths });
  }, [tableId, cloudTableColumnWidths]);

  // Resizing state
  const resizingRef = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const [activeResizingKey, setActiveResizingKey] = useState<string | null>(null);

  const startResize = useCallback(
    (colKey: string, e: React.MouseEvent | React.TouchEvent) => {
      if (!enableTableColumnResize) return;
      e.preventDefault();
      e.stopPropagation();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const currentWidth = widths[colKey] || defaultWidths[colKey] || 100;

      resizingRef.current = {
        colKey,
        startX: clientX,
        startWidth: currentWidth,
      };
      setActiveResizingKey(colKey);

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!resizingRef.current) return;
        const currentX =
          'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const delta = currentX - resizingRef.current.startX;
        const newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, Math.round(resizingRef.current.startWidth + delta))
        );

        setWidths((prev) => ({
          ...prev,
          [resizingRef.current!.colKey]: newWidth,
        }));
      };

      const handleEnd = () => {
        if (resizingRef.current) {
          const finishedColKey = resizingRef.current.colKey;
          setWidths((latest) => {
            setTableColumnWidthsStore(tableId, latest);
            return latest;
          });
        }
        resizingRef.current = null;
        setActiveResizingKey(null);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    },
    [enableTableColumnResize, widths, defaultWidths, minWidth, maxWidth, tableId, setTableColumnWidthsStore]
  );

  const resetWidths = useCallback(() => {
    resetTableColumnWidthsStore(tableId);
    setWidths({ ...defaultWidths });
  }, [tableId, defaultWidths, resetTableColumnWidthsStore]);

  return {
    widths,
    startResize,
    resetWidths,
    isResizing: !!activeResizingKey,
    activeResizingKey,
    enableTableColumnResize,
  };
}
