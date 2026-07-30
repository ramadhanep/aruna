"use client";

import { useState, useEffect, useCallback } from 'react';
import { SCREENING_CATEGORIES, matchScreeningEntry } from '@/lib/chart-helpers';

export function useChartScreening(supabase, symbol) {
  const [screeningSignal, setScreeningSignal] = useState(null);

  const loadScreeningSignal = useCallback(async () => {
    if (!supabase) {
      setScreeningSignal(null);
      return;
    }
    const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
    if (!normalizedSymbol) {
      setScreeningSignal(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('screening_snapshots')
        .select('category, results')
        .in('category', SCREENING_CATEGORIES);
      if (error) throw error;

      let found = null;
      data?.some((snapshot) => {
        const match = matchScreeningEntry(snapshot.results, normalizedSymbol);
        if (match) {
          found = { ...match, category: snapshot.category };
          return true;
        }
        return false;
      });
      setScreeningSignal(found);
    } catch (error) {
      console.warn('Failed to load screening snapshots', error);
      setScreeningSignal(null);
    }
  }, [supabase, symbol]);

  useEffect(() => {
    queueMicrotask(() => {
      loadScreeningSignal();
    });
  }, [loadScreeningSignal]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('election_cycle_screening')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'screening_snapshots' },
        () => {
          loadScreeningSignal();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadScreeningSignal]);

  useEffect(() => {
    queueMicrotask(() => {
      setScreeningSignal(null);
    });
  }, [symbol]);

  return { screeningSignal };
}
