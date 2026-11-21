'use client';
import { useEffect } from 'react';

export default function VisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('kia_visit')) return;
      sessionStorage.setItem('kia_visit', '1');
    } catch { /* storage blocked: still log */ }
    fetch('/api/visit', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}
